# Enhanced AI-Powered AR Spot Explanations

Make the Gemini-enhanced AR explanations smarter and more contextual by making them **type-aware** (artwork → history, café → audience fit) and **itinerary-aware** (compare to what's already in the user's route).

## User Review Required

> [!IMPORTANT]
> **New fields replace old ones.** The current `headline`, `knownFor`, `whatPeopleSay`, and `tip` fields will be replaced by `whatIsThis`, `whoIsThisFor`, `shouldYouSwitch`, and `quickFact`. The `friendSays` field stays unchanged. This changes the API response shape — if anything else consumes `/api/v1/ar/explain`, it will break.

> [!IMPORTANT]
> **Token budget increase.** The new prompt is richer, so `maxOutputTokens` will go from 800 → 1024. This may slightly increase Gemini API costs per request (still well within free tier limits per call).

## Open Questions

> [!IMPORTANT]
> **`shouldYouSwitch` for non-itinerary mode.** When a user enters AR via `/ar/spot/:spotId` (no itinerary), there's nothing to compare against. The plan sets `shouldYouSwitch` to `null` in this case. Is that fine, or would you prefer a different fallback like a generic recommendation?

## Proposed Changes

### Backend — DTO

#### [MODIFY] [SpotExplanation.java](file:///c:/Users/looil/Desktop/radach/maps/src/main/java/com/radach/maps/dto/SpotExplanation.java)

Replace the current fields with:

| Old Field | New Field | Purpose |
|---|---|---|
| `headline` | `whatIsThis` | Type-specific identity. Artwork → history/artist. Café → specialty/vibe. Viewpoint → what you'll see. |
| `knownFor` | `whoIsThisFor` | Who would enjoy this spot. E.g. *"Remote workers who want quiet Wi-Fi"* or *"History buffs and architecture fans"* |
| `whatPeopleSay` | *(removed)* | Absorbed into `whatIsThis` and `quickFact` |
| `tip` | `quickFact` | One surprising/useful detail pulled from reviews or tags. E.g. *"They roast in-house every Tuesday"* |
| *(new)* | `shouldYouSwitch` | Nullable. If the user's itinerary has a similar spot, compare them. E.g. *"Your stop #3 has better pastries, but this one has outdoor seating and stronger coffee."* |
| `friendSays` | `friendSays` | *(unchanged)* |
| `aiEnhanced` | `aiEnhanced` | *(unchanged)* |

New record:
```java
public record SpotExplanation(
    Long spotId,
    String spotName,
    String whatIsThis,       // Type-aware identity/description
    String whoIsThisFor,     // Audience fit
    String quickFact,        // One surprising/useful detail
    String shouldYouSwitch,  // Nullable — itinerary comparison
    String friendSays,       // Nullable — friend's review
    boolean aiEnhanced
) {}
```

---

### Backend — Service Layer

#### [MODIFY] [ARService.java](file:///c:/Users/looil/Desktop/radach/maps/src/main/java/com/radach/maps/service/ARService.java)

1. **Change method signature**: `buildExplanation(Long spotId, Long userId)` → `buildExplanation(Long spotId, Long userId, Long itineraryId)`
2. **Load itinerary context**: If `itineraryId` is provided, load the itinerary stops and find the most similar stop (same type) to pass to Gemini for the `shouldYouSwitch` comparison.
3. **Update rule-based fallback**: Generate sensible defaults for the new fields when Gemini is unavailable:
   - `whatIsThis`: Use type + address + top vibe tags (similar to current `headline` + `knownFor`)
   - `whoIsThisFor`: Hardcoded per type (e.g. café → *"Coffee lovers and casual visitors"*)
   - `quickFact`: Pull from the best review excerpt (similar to current `whatPeopleSay`)
   - `shouldYouSwitch`: `null` in rule-based mode (can't compare without AI)
4. **Pass itinerary context to GeminiClient**: Add a new parameter for the similar itinerary stop's name, type, and reviews so Gemini can compare.

#### [MODIFY] [GeminiClient.java](file:///c:/Users/looil/Desktop/radach/maps/src/main/java/com/radach/maps/service/GeminiClient.java)

1. **Update `enhanceExplanation` signature**: Accept an optional "similar itinerary stop" context object.
2. **Rewrite the prompt** to be type-aware:
   - Include type-specific instructions (e.g. *"This is a café. Describe its specialty, atmosphere, and who would enjoy it."*)
   - Include itinerary context block (only when an itinerary stop of the same type exists)
   - Request the new JSON fields: `whatIsThis`, `whoIsThisFor`, `quickFact`, `shouldYouSwitch`
3. **Update JSON parsing**: Map the new field names from Gemini's response to the new `SpotExplanation` record.
4. **Increase `maxOutputTokens`** from 800 → 1024 for the richer responses.

---

### Backend — Controller

#### [MODIFY] [ARController.java](file:///c:/Users/looil/Desktop/radach/maps/src/main/java/com/radach/maps/controller/ARController.java)

Add an optional `itineraryId` query parameter to the `/explain` endpoint:

```java
@GetMapping("/explain")
public SpotExplanation explain(
    @RequestParam Long spotId,
    @RequestParam(required = false) Long itineraryId,
    Authentication auth
) {
    return arService.buildExplanation(spotId, getUserIdOrNull(auth), itineraryId);
}
```

---

### Frontend

#### [MODIFY] [ARViewPage.jsx](file:///c:/Users/looil/Desktop/radach/maps/frontend/src/pages/ARViewPage.jsx)

1. **Pass `itineraryId` to the explain endpoint** (line ~236):
   ```js
   const url = `/api/v1/ar/explain?spotId=${poi.id}${itineraryId ? `&itineraryId=${itineraryId}` : ''}`
   const res = await apiFetch(url)
   ```
   Note: `itineraryId` is already available from `useParams()` on line 43.

2. **Update the info sheet UI** (lines ~583–615) to render the new fields:
   - **"What is this"** section with the `whatIsThis` text — the primary description block
   - **"Who is this for"** section with a 👥 icon and `whoIsThisFor` text
   - **"Quick fact"** with a 💡 icon and `quickFact` (replaces the old `tip`)
   - **"Should you switch?"** section (only shown when `shouldYouSwitch` is not null) — styled with a distinct color/border to draw attention, with a 🔄 icon
   - **"A friend says"** stays the same

#### [MODIFY] [ARViewPage.css](file:///c:/Users/looil/Desktop/radach/maps/frontend/src/pages/ARViewPage.css)

Add styles for the new sections:
- `.ar-explanation-switch` — a distinct card with a purple-tinted border for the "Should you switch?" section
- `.ar-explanation-audience` — subtle styling for the "Who is this for" line
- `.ar-explanation-fact` — italic styling for the quick fact (similar to current `.ar-explanation-text` tip style)

---

## Verification Plan

### Manual Verification
1. Restart Spring Boot backend after changes
2. Open AR Explorer for an itinerary that has a café → tap on a nearby café → verify `shouldYouSwitch` appears comparing the two
3. Open AR Explorer for a single spot (no itinerary) → tap a spot → verify `shouldYouSwitch` is absent and other fields render correctly
4. Disable Gemini (`GEMINI_ENABLED=false`) → tap a spot → verify the rule-based fallback renders all new fields correctly
5. Check the JSON response in browser DevTools to confirm `aiEnhanced: true` and all new field names are present
