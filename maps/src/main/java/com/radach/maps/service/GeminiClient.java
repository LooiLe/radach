package com.radach.maps.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.radach.maps.dto.SpotExplanation;
import com.radach.maps.model.Review;
import com.radach.maps.model.Spot;

@Service
@ConditionalOnProperty(name = "gemini.enabled", havingValue = "true")
public class GeminiClient {
    private static final Logger log = LoggerFactory.getLogger(GeminiClient.class);
    private static final String PLACEHOLDER_KEY = "your-gemini-api-key-here";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final String endpoint;
    private final Duration requestTimeout;
    private final int maxOutputTokens;

    public GeminiClient(
            ObjectMapper objectMapper,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model:gemini-2.0-flash}") String model,
            @Value("${gemini.endpoint:https://generativelanguage.googleapis.com/v1beta}") String endpoint,
            @Value("${gemini.connect-timeout-ms:2000}") long connectTimeoutMs,
            @Value("${gemini.request-timeout-ms:3500}") long requestTimeoutMs,
            @Value("${gemini.max-output-tokens:2048}") int maxOutputTokens
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? "gemini-2.0-flash" : model.trim();
        this.endpoint = endpoint == null || endpoint.isBlank()
                ? "https://generativelanguage.googleapis.com/v1beta"
                : endpoint.trim().replaceAll("/+$", "");
        this.requestTimeout = Duration.ofMillis(Math.max(500, requestTimeoutMs));
        this.maxOutputTokens = Math.max(512, maxOutputTokens);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.max(500, connectTimeoutMs)))
                .build();
    }

    public Optional<SpotExplanation> enhanceExplanation(
            SpotExplanation base,
            Spot spot,
            List<String> vibeNames,
            List<Review> reviews,
            Spot similarSpot,
            List<Review> similarReviews
    ) {
        if (!isConfigured()) {
            log.warn("Gemini is enabled but GEMINI_API_KEY is missing or still a placeholder; using rule-based AR explanation.");
            return Optional.empty();
        }

        String responseText = "";
        try {
            String prompt = buildPrompt(base, spot, vibeNames, reviews, similarSpot, similarReviews);
            responseText = generateContent(prompt);
            if (responseText.isBlank()) {
                return Optional.empty();
            }

            return Optional.of(toSpotExplanation(base, objectMapper.readTree(responseText)));
        } catch (JsonProcessingException e) {
            log.debug(
                    "Gemini returned malformed AR explanation JSON for spot {}; retrying once. Raw response preview: {}",
                    base.spotId(),
                    preview(responseText)
            );
            return retryMalformedResponse(base, responseText);
        } catch (HttpTimeoutException e) {
            log.debug("Gemini AR explanation enhancement timed out for spot {}; using rule-based explanation.", base.spotId());
            return Optional.empty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.debug("Gemini AR explanation enhancement interrupted for spot {}; using rule-based explanation.", base.spotId());
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Gemini AR explanation enhancement failed for spot {}: {}", base.spotId(), e.getMessage());
            return Optional.empty();
        }
    }

    private boolean isConfigured() {
        return !apiKey.isBlank() && !PLACEHOLDER_KEY.equals(apiKey);
    }

    private Optional<SpotExplanation> retryMalformedResponse(SpotExplanation base, String malformedResponse) {
        try {
            String retryResponse = generateContent(buildJsonRepairPrompt(base, malformedResponse));
            if (retryResponse.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(toSpotExplanation(base, objectMapper.readTree(retryResponse)));
        } catch (HttpTimeoutException e) {
            log.debug("Gemini AR explanation JSON repair timed out for spot {}; using rule-based explanation.", base.spotId());
            return Optional.empty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.debug("Gemini AR explanation JSON repair interrupted for spot {}; using rule-based explanation.", base.spotId());
            return Optional.empty();
        } catch (Exception e) {
            log.debug("Gemini AR explanation JSON repair failed for spot {}; using rule-based explanation: {}", base.spotId(), e.getMessage());
            return Optional.empty();
        }
    }

    private SpotExplanation toSpotExplanation(SpotExplanation base, JsonNode enhanced) {
        JsonNode switchNode = enhanced.path("shouldYouSwitch");
        String shouldYouSwitchVal = (switchNode.isMissingNode() || switchNode.isNull()) ? null : switchNode.asText(null);

        return new SpotExplanation(
                base.spotId(),
                base.spotName(),
                textOrFallback(enhanced, "whatIsThis", base.whatIsThis()),
                textOrFallback(enhanced, "whoIsThisFor", base.whoIsThisFor()),
                textOrFallback(enhanced, "quickFact", base.quickFact()),
                shouldYouSwitchVal,
                base.friendSays(),
                stringListOrFallback(enhanced, "highlights", base.highlights()),
                textOrFallback(enhanced, "visitTip", base.visitTip()),
                true
        );
    }

    private String generateContent(String prompt) throws IOException, InterruptedException {
        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", prompt))
        )));

        Map<String, Object> responseSchema = new LinkedHashMap<>();
        responseSchema.put("type", "OBJECT");
        responseSchema.put("properties", Map.of(
                "whatIsThis", Map.of("type", "STRING"),
                "whoIsThisFor", Map.of("type", "STRING"),
                "quickFact", Map.of("type", "STRING"),
                "shouldYouSwitch", Map.of("type", "STRING", "nullable", true),
                "highlights", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")),
                "visitTip", Map.of("type", "STRING")
        ));
        responseSchema.put("required", List.of("whatIsThis", "whoIsThisFor", "quickFact", "shouldYouSwitch", "highlights", "visitTip"));

        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("temperature", 0.2);
        generationConfig.put("maxOutputTokens", maxOutputTokens);
        generationConfig.put("responseMimeType", "application/json");
        generationConfig.put("responseSchema", responseSchema);
        if (normalizedModel().contains("2.5")) {
            generationConfig.put("thinkingConfig", Map.of("thinkingBudget", 0));
        }
        requestBody.put("generationConfig", generationConfig);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint + "/models/" + normalizedModel() + ":generateContent"))
                .timeout(requestTimeout)
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("Gemini returned HTTP " + response.statusCode());
        }

        log.debug("Gemini API raw response body: {}", response.body());

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode parts = root.path("candidates").path(0).path("content").path("parts");
        if (!parts.isArray()) {
            return "";
        }

        StringBuilder text = new StringBuilder();
        for (JsonNode part : parts) {
            String partText = part.path("text").asText("");
            if (!partText.isBlank()) {
                text.append(partText);
            }
        }
        return stripJsonFence(text.toString().trim());
    }

    private String buildPrompt(
            SpotExplanation base,
            Spot spot,
            List<String> vibeNames,
            List<Review> reviews,
            Spot similarSpot,
            List<Review> similarReviews
    ) {
        String reviewText = reviews.stream()
                .limit(4)
                .map(review -> "- " + review.getReviewType() + " " + review.getRating() + "/5: " + trim(review.getBody(), 260))
                .reduce("", (left, right) -> left + right + "\n");

        String similarSpotBlock = "";
        if (similarSpot != null) {
            String similarReviewText = similarReviews.stream()
                    .limit(3)
                    .map(review -> "- " + review.getReviewType() + " " + review.getRating() + "/5: " + trim(review.getBody(), 260))
                    .reduce("", (left, right) -> left + right + "\n");

            similarSpotBlock = """
                    
                    Comparison Itinerary Spot:
                    Name: %s
                    Type: %s
                    Reviews:
                    %s
                    
                    For 'shouldYouSwitch': Compare the target spot with this itinerary spot. Highlight the trade-offs (e.g. vibe, menu, views) and suggest whether they might want to swap or visit this one instead. Keep it under 180 characters.
                    """.formatted(
                    safe(similarSpot.getName()),
                    safe(similarSpot.getType()),
                    similarReviewText.isBlank() ? "No reviews available." : similarReviewText
            );
        } else {
            similarSpotBlock = "\nFor 'shouldYouSwitch': Return null, as there is no itinerary spot to compare against.\n";
        }

        String typeInstructions = getTypeAwareInstructions(spot.getType());

        return """
                You write concise travel AR overlay copy.
                
                Target Spot Type: %s
                Type-Specific Guidance:
                %s

                Return JSON only with these exact fields:
                whatIsThis (string), whoIsThisFor (string), quickFact (string), shouldYouSwitch (string or null), highlights (array of 3 short strings), visitTip (string)

                Rules:
                - Keep each field under 180 characters.
                - Keep each highlight under 70 characters.
                - Do not invent facts, prices, opening hours, awards, or cuisine.
                - Use the supplied rule-based text when reviews are thin.
                - shouldYouSwitch must be null unless a Comparison Itinerary Spot is provided.

                Target Spot Details:
                Name: %s
                Address: %s
                Tags: %s
                Vibes: %s

                Rule-based draft:
                whatIsThis: %s
                whoIsThisFor: %s
                quickFact: %s
                highlights: %s
                visitTip: %s
                friendSays: %s

                Approved reviews:
                %s
                %s
                """.formatted(
                safe(spot.getType()),
                typeInstructions,
                safe(spot.getName()),
                safe(spot.getAddress()),
                spot.getTags() == null ? List.of() : spot.getTags(),
                vibeNames == null ? List.of() : vibeNames,
                safe(base.whatIsThis()),
                safe(base.whoIsThisFor()),
                safe(base.quickFact()),
                base.highlights() == null ? List.of() : base.highlights(),
                safe(base.visitTip()),
                base.friendSays() == null ? "null" : safe(base.friendSays()),
                reviewText.isBlank() ? "No approved reviews supplied." : reviewText,
                similarSpotBlock
        );
    }

    private String buildJsonRepairPrompt(SpotExplanation base, String malformedResponse) {
        return """
                Return exactly one valid minified JSON object. No markdown. No prose.

                The previous response was malformed:
                %s

                Use these fallback values for any missing field:
                {
                  "whatIsThis": "%s",
                  "whoIsThisFor": "%s",
                  "quickFact": "%s",
                  "shouldYouSwitch": null,
                  "highlights": %s,
                  "visitTip": "%s"
                }
                """.formatted(
                trim(safe(malformedResponse), 500),
                jsonSafe(base.whatIsThis()),
                jsonSafe(base.whoIsThisFor()),
                jsonSafe(base.quickFact()),
                toJsonArray(base.highlights()),
                jsonSafe(base.visitTip())
        );
    }

    private String getTypeAwareInstructions(String rawType) {
        String type = rawType == null ? "" : rawType.trim().toLowerCase(java.util.Locale.ROOT);
        return switch (type) {
            case "cafe" -> "Describe the café's specialty (e.g. cold brew, pastries), the vibe/atmosphere, and who would enjoy relaxing or working here.";
            case "restaurant" -> "Describe the cuisine style, signature dishes, dining atmosphere, and who it suits (families, couples, solo dining).";
            case "bar" -> "Describe the beverage focus (cocktails, beer, wine), the crowd/energy, and the best time to visit.";
            case "hotel" -> "Describe the style/design, location advantage, and what interesting spots are walkable around it.";
            case "market" -> "Describe what kind of goods/food are sold, the vibe, and the best time to visit or what to look for.";
            case "viewpoint" -> "Describe what sights are visible from here, how to get the best view, and the ideal weather or time of day.";
            case "beach" -> "Describe the beach atmosphere (quiet, lively), water/sand quality, and what to bring or watch out for.";
            case "trail" -> "Describe the difficulty/terrain, key highlights along the way, and essential prep like shoes or water.";
            default -> "Describe the spot's unique characteristics, history, or purpose, and who would enjoy visiting.";
        };
    }

    private String normalizedModel() {
        return model.startsWith("models/") ? model.substring("models/".length()) : model;
    }

    private String textOrFallback(JsonNode node, String field, String fallback) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return fallback;
        }
        String text = value.asText("");
        return text.isBlank() ? fallback : text;
    }

    private List<String> stringListOrFallback(JsonNode node, String field, List<String> fallback) {
        JsonNode value = node.path(field);
        if (!value.isArray()) {
            return fallback == null ? List.of() : fallback;
        }
        List<String> values = new java.util.ArrayList<>();
        for (JsonNode item : value) {
            String text = item.asText("").trim();
            if (!text.isBlank()) {
                values.add(trim(text, 90));
            }
        }
        return values.isEmpty() ? (fallback == null ? List.of() : fallback) : values.stream().limit(5).toList();
    }

    private String stripJsonFence(String text) {
        if (text.startsWith("```json")) {
            text = text.substring("```json".length()).trim();
        } else if (text.startsWith("```")) {
            text = text.substring("```".length()).trim();
        }
        if (text.endsWith("```")) {
            text = text.substring(0, text.length() - 3).trim();
        }
        return text;
    }

    private String preview(String text) {
        if (text == null || text.isBlank()) {
            return "<empty>";
        }
        return trim(text, 240);
    }

    private String trim(String text, int maxLength) {
        if (text == null) {
            return "";
        }
        String normalized = text.replaceAll("\\s+", " ").trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength - 3) + "...";
    }

    private String safe(String text) {
        return text == null ? "" : text;
    }

    private String jsonSafe(String text) {
        try {
            String json = objectMapper.writeValueAsString(safe(text));
            return json.substring(1, json.length() - 1);
        } catch (JsonProcessingException e) {
            return "";
        }
    }

    private String toJsonArray(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values == null ? List.of() : values);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }
}
