package com.radach.maps.service.tagging;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

/**
 * Phase-1 {@link TagGenerator} backed by the shared keyword dictionary
 * in {@link TagKeywords} and word-boundary regex matching.
 *
 * <p>Behaviour, confidence floor (0.1), boost factor (1.3× when >50%
 * keywords match), and top-12 cap are all preserved verbatim from the
 * original implementation.</p>
 */
@Component
public class KeywordTagGenerator implements TagGenerator {

    private static final String NAME = "keyword";

    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public Map<String, Float> generate(String corpus) {
        if (corpus == null || corpus.isEmpty()) {
            return Map.of();
        }
        return keywordMatch(corpus);
    }

    /**
     * Score each vibe tag based on keyword matches.
     * Multiple hits on the same keyword only count once (binary per keyword),
     * but different keywords for the same tag stack.
     * Score is normalised to 0..1.
     */
    Map<String, Float> keywordMatch(String corpus) {
        String lower = corpus.toLowerCase();
        Map<String, Float> tagConfidences = new HashMap<>();

        for (Map.Entry<String, List<Pattern>> entry : TagKeywords.getAll().entrySet()) {
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
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }
}
