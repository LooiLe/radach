package com.radach.maps.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.Review;
import com.radach.maps.model.SpotVibeTag;
import com.radach.maps.model.VibeTagDefinition;
import com.radach.maps.repository.ReviewRepository;
import com.radach.maps.repository.SpotVibeTagRepository;
import com.radach.maps.repository.VibeTagDefinitionRepository;
import com.radach.maps.service.tagging.TagGenerator;

/**
 * Orchestrator that runs all registered {@link TagGenerator} beans against
 * the approved reviews of a spot, merges their results, and persists the
 * top tags to {@code spot_vibe_tags}.
 *
 * <p>The actual tag-generation algorithms live in
 * {@code com.radach.maps.service.tagging} — see {@link TagGenerator} and the
 * current {@code KeywordTagGenerator} implementation. To add a new generator
 * (e.g. an OpenAI-backed or embedding-based one), drop in a new
 * {@code @Component implements TagGenerator}; Spring auto-injects it into
 * {@code generators} below and it is picked up on the next run.</p>
 *
 * <p>Manual tags (rows with {@code source = "manual"}) are preserved across
 * re-analyses so admin-applied interventions aren't silently overwritten.</p>
 */
@Service
public class VibeAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(VibeAnalysisService.class);

    /** Sources that must survive a re-analysis (admin interventions). */
    private static final List<String> PRESERVE_SOURCES = List.of("manual");

    /** Cap on how many auto-generated tags we keep per spot. */
    private static final int TOP_TAG_LIMIT = 12;

    private final VibeTagDefinitionRepository vibeDefRepo;
    private final SpotVibeTagRepository spotVibeRepo;
    private final ReviewRepository reviewRepo;
    private final List<TagGenerator> generators;

    public VibeAnalysisService(VibeTagDefinitionRepository vibeDefRepo,
                                SpotVibeTagRepository spotVibeRepo,
                                ReviewRepository reviewRepo,
                                List<TagGenerator> generators) {
        this.vibeDefRepo = vibeDefRepo;
        this.spotVibeRepo = spotVibeRepo;
        this.reviewRepo = reviewRepo;
        this.generators = generators;
    }

    // ────────────────────────────────────────────────────────
    //  Orchestrator
    // ────────────────────────────────────────────────────────

    /**
     * Analyze all APPROVED reviews for a spot and regenerate its vibe tags.
     * Runs every registered {@link TagGenerator}, merges by max confidence
     * (keeping the winning generator's name as {@code source}), and preserves
     * any rows in {@code spot_vibe_tags} whose source is in {@link #PRESERVE_SOURCES}.
     */
    @Transactional
    public void analyzeSpot(Long spotId) {
        List<Review> reviews = reviewRepo.findBySpotIdAndStatus(spotId, Review.Status.APPROVED);

        if (reviews.isEmpty()) {
            log.info("No approved reviews for spot {}, clearing auto-generated vibe tags (preserving manual)", spotId);
            spotVibeRepo.deleteBySpotIdAndSourceNotIn(spotId, PRESERVE_SOURCES);
            return;
        }

        String corpus = reviews.stream()
                .map(Review::getBody)
                .filter(b -> b != null && !b.isBlank())
                .collect(Collectors.joining(" "));

        Map<String, MergedScore> merged = runAllGenerators(corpus);

        // Delete only auto-generated rows; keep manual interventions
        spotVibeRepo.deleteBySpotIdAndSourceNotIn(spotId, PRESERVE_SOURCES);

        // Don't re-insert tags the admin already pinned manually
        List<SpotVibeTag> existingManual = spotVibeRepo.findBySpotId(spotId).stream()
                .filter(svt -> PRESERVE_SOURCES.contains(svt.getSource()))
                .toList();
        java.util.Set<Long> manualTagIds = existingManual.stream()
                .map(SpotVibeTag::getVibeTagId)
                .collect(Collectors.toSet());

        List<VibeTagDefinition> allDefs = vibeDefRepo.findAll();
        Map<String, VibeTagDefinition> defsByName = allDefs.stream()
                .collect(Collectors.toMap(VibeTagDefinition::getName, d -> d, (a, b) -> a));

        // Sort by confidence desc, take top N
        List<MergedScore> top = merged.values().stream()
                .sorted(Comparator.comparingDouble((MergedScore m) -> m.confidence).reversed())
                .limit(TOP_TAG_LIMIT)
                .toList();

        int inserted = 0;
        for (MergedScore score : top) {
            VibeTagDefinition def = defsByName.get(score.tagName);
            if (def == null) {
                // Tag returned by a generator that doesn't exist in the dictionary yet — skip.
                continue;
            }
            if (manualTagIds.contains(def.getId())) {
                // Admin already pinned this tag manually — don't double-write.
                continue;
            }
            spotVibeRepo.save(new SpotVibeTag(spotId, def.getId(), score.confidence, score.source));
            inserted++;
        }

        log.info("Analyzed spot {} → {} vibe tag(s) inserted across {} generator(s)",
                spotId, inserted, generators.size());
    }

    /** Run every generator and merge by tag name (max confidence wins; tie-break by source order). */
    private Map<String, MergedScore> runAllGenerators(String corpus) {
        Map<String, MergedScore> merged = new HashMap<>();
        if (generators.isEmpty()) {
            log.warn("No TagGenerator beans registered — vibe analysis will be a no-op");
            return merged;
        }
        for (TagGenerator gen : generators) {
            try {
                Map<String, Float> scores = gen.generate(corpus);
                for (Map.Entry<String, Float> e : scores.entrySet()) {
                    if (e.getValue() == null) continue;
                    merged.merge(e.getKey(),
                            new MergedScore(e.getKey(), e.getValue(), gen.getName()),
                            (existing, incoming) -> incoming.confidence > existing.confidence ? incoming : existing);
                }
            } catch (Exception ex) {
                log.error("TagGenerator '{}' failed; continuing with other generators", gen.getName(), ex);
            }
        }
        return merged;
    }

    // ────────────────────────────────────────────────────────
    //  Admin intervention
    // ────────────────────────────────────────────────────────

    /**
     * Manually add a vibe tag to a spot (admin only). Upserts on conflict so
     * re-adding the same tag is idempotent. Source is recorded as {@code "manual"}.
     */
    @Transactional
    public SpotVibeTag addManualTag(Long spotId, Long vibeTagId, Float confidence) {
        VibeTagDefinition def = vibeDefRepo.findById(vibeTagId)
                .orElseThrow(() -> new ResourceNotFoundException("Vibe tag definition not found: " + vibeTagId));
        float conf = confidence == null ? 1.0f : Math.max(0f, Math.min(1f, confidence));

        // Upsert: replace any existing row for (spot, tag) so admin's manual override wins.
        List<SpotVibeTag> existing = spotVibeRepo.findBySpotId(spotId);
        for (SpotVibeTag svt : existing) {
            if (svt.getVibeTagId().equals(def.getId())) {
                svt.setConfidence(conf);
                svt.setSource("manual");
                return spotVibeRepo.save(svt);
            }
        }
        return spotVibeRepo.save(new SpotVibeTag(spotId, def.getId(), conf, "manual"));
    }

    /**
     * Remove a specific tag from a spot. Returns true if a row was deleted.
     */
    @Transactional
    public boolean removeTag(Long spotId, Long vibeTagId) {
        List<SpotVibeTag> existing = spotVibeRepo.findBySpotId(spotId);
        boolean removed = false;
        for (SpotVibeTag svt : existing) {
            if (svt.getVibeTagId().equals(vibeTagId)) {
                spotVibeRepo.delete(svt);
                removed = true;
            }
        }
        return removed;
    }

    // ────────────────────────────────────────────────────────
    //  Bulk triggers
    // ────────────────────────────────────────────────────────

    /** Re-analyze every spot that has at least one approved review. */
    @Async
    public void analyzeAllSpots() {
        List<Long> spotIds = reviewRepo.findDistinctSpotIdsWithApprovedReviews();
        log.info("Running vibe analysis for {} spots", spotIds.size());
        for (Long id : spotIds) {
            try {
                analyzeSpot(id);
            } catch (Exception e) {
                log.error("Failed to analyze spot {}", id, e);
            }
        }
    }

    /** Backfill: on startup, analyze all spots that have approved reviews. */
    @PostConstruct
    public void backfillOnStartup() {
        log.info("Running vibe tag backfill from existing reviews...");
        try {
            analyzeAllSpots();
        } catch (Exception e) {
            log.error("Vibe tag backfill failed (expected if DB migration hasn't run yet)", e);
        }
    }

    /** Nightly full re-analysis of all spots with reviews (runs at 2 AM). */
    @Scheduled(cron = "0 0 2 * * ?")
    public void scheduledReanalysis() {
        log.info("Starting nightly vibe tag re-analysis...");
        analyzeAllSpots();
        log.info("Nightly vibe tag re-analysis complete.");
    }

    // ────────────────────────────────────────────────────────
    //  Helpers
    // ────────────────────────────────────────────────────────

    /** Mutable carrier for a single tag's merged score + winning source. */
    private static final class MergedScore {
        final String tagName;
        final float confidence;
        final String source;
        MergedScore(String tagName, float confidence, String source) {
            this.tagName = tagName;
            this.confidence = confidence;
            this.source = source;
        }
    }
}
