package com.radach.maps.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.model.Review;
import com.radach.maps.model.SpotVibeTag;
import com.radach.maps.model.VibeTagDefinition;
import com.radach.maps.repository.ReviewRepository;
import com.radach.maps.repository.SpotVibeTagRepository;
import com.radach.maps.repository.VibeTagDefinitionRepository;

/**
 * NLP-powered service that analyzes review text to automatically generate
 * vibe-based tags for spots.
 * 
 * Architecture (3 phases):
 *   Phase 1 – Keyword matching (current, zero external deps)
 *   Phase 2 – PostgreSQL full-text + synonym expansion
 *   Phase 3 – OpenAI API / vector embeddings for semantic understanding
 * 
 * Each phase builds on the previous; all co-exist peacefully.
 */
@Service
public class VibeAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(VibeAnalysisService.class);

    private final VibeTagDefinitionRepository vibeDefRepo;
    private final SpotVibeTagRepository spotVibeRepo;
    private final ReviewRepository reviewRepo;

    public VibeAnalysisService(VibeTagDefinitionRepository vibeDefRepo,
                                SpotVibeTagRepository spotVibeRepo,
                                ReviewRepository reviewRepo) {
        this.vibeDefRepo = vibeDefRepo;
        this.spotVibeRepo = spotVibeRepo;
        this.reviewRepo = reviewRepo;
    }

    // ────────────────────────────────────────────────────────
    //  Phase 1: Keyword rule engine (zero external deps)
    // ────────────────────────────────────────────────────────

    /**
     * Each vibe tag maps to a list of keyword patterns.
     * Keywords are normalised (lowercased, trimmed).
     * Matches use word-boundary regex so "cozy" doesn't match "cozying".
     */
    private static final Map<String, List<Pattern>> KEYWORD_RULES = buildKeywordRules();

    private static Map<String, List<Pattern>> buildKeywordRules() {
        Map<String, List<Pattern>> rules = new HashMap<>();

        rules.put("cozy", patterns("cozy", "cosy", "intimate", "warm atmosphere", "snug"));
        rules.put("romantic", patterns("romantic", "date night", "couples", "candlelit", "candle light"));
        rules.put("lively", patterns("lively", "bustling", "energetic", "happening", "buzzy", "vibrant"));
        rules.put("chill", patterns("chill", "laid.?back", "relaxed", "mellow", "low.key", "chilled"));
        rules.put("aesthetic", patterns("aesthetic", "beautiful decor", "beautiful interior", "stylish", "gorgeous"));
        rules.put("sunset views", patterns("sunset", "sunsets", "sun set", "panoramic view", "scenic", "great view", "nice view", "breathtaking"));
        rules.put("outdoor seating", patterns("outdoor", "outdoor seating", "terrace", "patio", "al fresco", "alfresco", "garden seating", "rooftop"));
        rules.put("good for studying", patterns("study", "studying", "get work done", "work here", "good wifi", "good wi-fi", "quiet enough to work", "laptop friendly"));
        rules.put("good for groups", patterns("group", "groups", "gathering", "get together", "party", "large group", "big group"));
        rules.put("late night spot", patterns("late night", "open late", "opens late", "after midnight", "2am", "3am", "4am", "night owl"));
        rules.put("breakfast spot", patterns("breakfast", "brunch", "morning", "early"));
        rules.put("budget friendly", patterns("budget", "cheap", "affordable", "reasonably priced", "good value", "inexpensive", "not expensive", "under \\$", "low price"));
        rules.put("pricey", patterns("pricey", "expensive", "overpriced", "costly", "spendy", "premium price", "upscale", "high end"));
        rules.put("digital nomad friendly", patterns("digital nomad", "remote work", "good wifi", "good wi-fi", "power outlet", "work from", "coworking", "co-working"));
        rules.put("touristy", patterns("tourist", "touristy", "tourist trap", "overrun", "crowded with tourists", "tourist spot"));
        rules.put("local favorite", patterns("local", "locals", "hidden gem", "authentic", "off the beaten path", "underrated"));
        rules.put("family friendly", patterns("family", "kids", "children", "child friendly", "kid friendly", "baby", "stroller"));
        rules.put("pet friendly", patterns("pet", "dog", "dog friendly", "dogs welcome", "pets", "furry"));
        rules.put("hidden gem", patterns("hidden gem", "off the beaten path", "undiscovered", "secret spot", "tucked away"));
        rules.put("trendy", patterns("trendy", "hip", "cool", "fashionable", "insta.*famous", "hottest"));
        rules.put("quiet", patterns("quiet", "peaceful", "serene", "tranquil", "noiseless", "silent", "calm"));
        rules.put("spacious", patterns("spacious", "roomy", "big", "large", "plenty of space", "open space", "airy"));
        rules.put("fast service", patterns("fast service", "quick", "speedy", "efficient", "prompt", "no wait", "on point service"));
        rules.put("instagrammable", patterns("instagram", "insta", "photo", "picturesque", "beautiful", "pretty", "snap", "pics", "instagramable"));

        // ── Food & Drink specific ──
        rules.put("brunch", patterns("brunch", "breakfast", "morning", "eggs benedict", "pancakes", "avocado toast", "waffles"));
        rules.put("burgers", patterns("burger", "burgers", "patty", "fries", "cheeseburger", "bun"));
        rules.put("pasta", patterns("pasta", "spaghetti", "carbonara", "bolognese", "noodles", "fettuccine", "penne"));
        rules.put("coffee", patterns("coffee", "latte", "cappuccino", "espresso", "flat white", "cold brew", "mocha", "brew"));
        rules.put("matcha", patterns("matcha", "green tea", "matcha latte"));
        rules.put("thai food", patterns("thai", "pad thai", "green curry", "tom yum", "massaman", "som tum", "thai food", "spicy"));
        rules.put("sushi", patterns("sushi", "sashimi", "maki", "nigiri", "roll", "japanese"));
        rules.put("pizza", patterns("pizza", "margherita", "pepperoni", "neapolitan", "wood.fire", "thin crust"));
        rules.put("seafood", patterns("seafood", "fish", "shrimp", "oyster", "crab", "lobster", "fresh fish"));
        rules.put("desserts", patterns("dessert", "cake", "pastry", "pie", "ice cream", "sweet", "chocolate cake", "tiramisu"));
        rules.put("vegan friendly", patterns("vegan", "plant.based", "vegetarian", "veggie", "tofu", "dairy.free"));

        // ── Atmosphere & Views ──
        rules.put("outdoor seating", patterns("outdoor", "outdoor seating", "terrace", "patio", "al fresco", "alfresco", "garden seating", "rooftop"));
        rules.put("beautiful view", patterns("beautiful view", "great view", "nice view", "scenic", "panoramic", "stunning view", "amazing view", "breathtaking view", "city view", "ocean view", "river view"));
        rules.put("live music", patterns("live music", "live band", "dj", "acoustic", "concert", "musician", "jazz", "performance"));

        return rules;
    }

    private static List<Pattern> patterns(String... keywords) {
        List<Pattern> result = new ArrayList<>();
        for (String kw : keywords) {
            // Word-boundary regex so "cozy" doesn't match "cozying"
            result.add(Pattern.compile("\\b" + Pattern.quote(kw.toLowerCase()) + "\\b", Pattern.CASE_INSENSITIVE));
        }
        return result;
    }

    // ────────────────────────────────────────────────────────
    //  Public API
    // ────────────────────────────────────────────────────────

    /**
     * Analyze all APPROVED reviews for a spot and regenerate its vibe tags.
     * Uses keyword matching (Phase 1).
     */
    @Transactional
    public void analyzeSpot(Long spotId) {
        // 1. Fetch all approved reviews for this spot
        List<Review> reviews = reviewRepo.findBySpotIdAndStatus(spotId, Review.Status.APPROVED);
        if (reviews.isEmpty()) {
            log.info("No approved reviews for spot {}, clearing vibe tags", spotId);
            spotVibeRepo.deleteBySpotId(spotId);
            return;
        }

        // 2. Concatenate all review bodies for analysis
        String corpus = reviews.stream()
                .map(Review::getBody)
                .collect(Collectors.joining(" "));

        // 3. Phase 1: keyword matching
        Map<String, Float> scores = keywordMatch(corpus);

        // 4. Persist results (replace existing)
        spotVibeRepo.deleteBySpotId(spotId);
        List<VibeTagDefinition> allDefs = vibeDefRepo.findAll();

        // Sort scores descending by confidence and limit to top 12
        List<Map.Entry<String, Float>> topScores = scores.entrySet().stream()
                .filter(e -> e.getValue() > 0)
                .sorted(Map.Entry.<String, Float>comparingByValue().reversed())
                .limit(12)
                .collect(Collectors.toList());

        for (Map.Entry<String, Float> entry : topScores) {
            // Find the definition by name
            Optional<VibeTagDefinition> defOpt = allDefs.stream()
                    .filter(d -> d.getName().equals(entry.getKey()))
                    .findFirst();
            if (defOpt.isEmpty()) continue;

            SpotVibeTag svt = new SpotVibeTag(
                    spotId,
                    defOpt.get().getId(),
                    entry.getValue(),
                    "keyword"
            );
            spotVibeRepo.save(svt);
        }

        log.info("Analyzed spot {} → {} vibe tags", spotId, topScores.size());
    }

    /**
     * Analyze all spots that have new approved reviews.
     * Designed to be called on a schedule or after review creation.
     */
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

    /**
     * Backfill: on startup, analyze all spots that have approved reviews.
     * This seeds the vibe tags from the existing database data immediately.
     */
    @PostConstruct
    public void backfillOnStartup() {
        log.info("Running vibe tag backfill from existing reviews...");
        try {
            analyzeAllSpots();
        } catch (Exception e) {
            log.error("Vibe tag backfill failed (expected if DB migration hasn't run yet)", e);
        }
    }

    /**
     * Nightly full re-analysis of all spots with reviews (runs at 2 AM).
     * This catches any drift as new reviews accumulate.
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void scheduledReanalysis() {
        log.info("Starting nightly vibe tag re-analysis...");
        analyzeAllSpots();
        log.info("Nightly vibe tag re-analysis complete.");
    }

    // ────────────────────────────────────────────────────────
    //  Internal: Keyword matching engine
    // ────────────────────────────────────────────────────────

    /**
     * Score each vibe tag based on keyword matches.
     * Multiple hits on the same keyword only count once (binary per keyword),
     * but different keywords for the same tag stack.
     * Score is normalised to 0..1.
     */
    Map<String, Float> keywordMatch(String corpus) {
        String lower = corpus.toLowerCase();
        Map<String, Float> tagConfidences = new HashMap<>();
        Map<String, Float> tagMaxPossible = new HashMap<>();

        for (Map.Entry<String, List<Pattern>> entry : KEYWORD_RULES.entrySet()) {
            String tagName = entry.getKey();
            List<Pattern> patterns = entry.getValue();
            float hits = 0;
            for (Pattern p : patterns) {
                if (p.matcher(lower).find()) {
                    hits += 1.0f;
                }
            }
            float normalised = patterns.isEmpty() ? 0 : hits / patterns.size();
            // Boost: if more than half the keywords match, bump confidence
            if (hits >= patterns.size() * 0.5f && hits > 0) {
                normalised = Math.min(1.0f, normalised * 1.3f);
            }
            tagConfidences.put(tagName, normalised);
        }

        // Filter out low-confidence results (below 20%)
        return tagConfidences.entrySet().stream()
                .filter(e -> e.getValue() >= 0.1f)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    // ────────────────────────────────────────────────────────
    //  Phase 2 stub: Synonym expansion via PostgreSQL FTS
    // ────────────────────────────────────────────────────────

    /**
     * Phase 2 uses PostgreSQL's full-text search with thesaurus dictionaries.
     * This would add synonym expansion so "cheap" → "budget friendly".
     * 
     * SQL to create synonym thesaurus (run manually once):
     * 
     *   CREATE TEXT SEARCH DICTIONARY vibe_thesaurus (
     *       TEMPLATE = thesaurus,
     *       DictFile = vibe,
     *       Dictionary = english_stem
     *   );
     *   
     *   Then in /usr/share/postgresql/.../tsearch_data/vibe.ths:
     *   cheap budget-friendly
     *   affordable budget-friendly
     *   expensive pricey
     *   ...
     */

    // ────────────────────────────────────────────────────────
    //  Phase 3 stub: OpenAI / LLM API integration
    // ────────────────────────────────────────────────────────

    /**
     * Phase 3 would use an LLM to understand the semantic meaning of reviews
     * beyond keyword matching. Example prompt:
     * 
     *   "Given these reviews for a spot, which vibe tags apply?
     *    Reviews: {corpus}
     *    Vibe tags: {valid tags}
     *    Return a comma-separated list of matching tags with confidence scores."
     * 
     * Endpoint: POST /api/v1/vibe/analyze-ai
     * 
     * Implementation would use OpenAI API (gpt-4o-mini) via Spring's RestClient:
     * 
     *   String response = restClient.post()
     *       .uri("https://api.openai.com/v1/chat/completions")
     *       .header("Authorization", "Bearer " + openAiKey)
     *       .body(new ChatRequest(...))
     *       .retrieve()
     *       .body(String.class);
     * 
     * Enable by setting: app.vibe.ai-api-key=${OPENAI_API_KEY}
     */
}