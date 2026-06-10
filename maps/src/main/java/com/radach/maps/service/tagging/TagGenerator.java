package com.radach.maps.service.tagging;

import java.util.Map;

/**
 * Strategy interface for generating vibe tags from a corpus of approved review text.
 *
 * <p>Implementations are auto-discovered as Spring beans and injected as a list
 * into {@link com.radach.maps.service.VibeAnalysisService}, which orchestrates
 * them and persists the merged results to {@code spot_vibe_tags}.</p>
 *
 * <p>Add a new generator (e.g. an OpenAI-backed or embedding-based one) by
 * implementing this interface as a {@code @Component} — no other code changes
 * are required.</p>
 */
public interface TagGenerator {

    /**
     * Stable, lowercase identifier for this generator.
     * Written to {@code spot_vibe_tags.source} so we can tell which generator
     * produced each row (e.g. {@code "keyword"}, {@code "ai"}, {@code "embedding"}).
     */
    String getName();

    /**
     * Analyze the given corpus (concatenated approved review bodies for a spot)
     * and return a map of {@code tagDefinitionName -> confidence} in {@code [0, 1]}.
     *
     * <p>Tags with confidence below the orchestrator's threshold (currently 0.1)
     * will be filtered out downstream, so generators can be liberal in what they
     * return.</p>
     *
     * @param corpus concatenated, lowercased review text (may be empty)
     * @return map of vibe tag name to confidence score
     */
    Map<String, Float> generate(String corpus);
}
