package com.radach.maps.service.tagging;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Shared keyword dictionary for vibe tags.
 *
 * <p>Used by {@link KeywordTagGenerator} for tag generation and by
 * {@link com.radach.maps.service.ReviewService} for client-side
 * review filtering. This is the single source of truth for keyword patterns.</p>
 */
public final class TagKeywords {

    private TagKeywords() {}

    /** tag name → list of compiled keyword patterns (case-insensitive). */
    private static final Map<String, List<Pattern>> KEYWORDS = buildKeywords();

    /** Returns the keyword patterns for a given tag name, or an empty list if unknown. */
    public static List<Pattern> getPatterns(String tagName) {
        return KEYWORDS.getOrDefault(tagName, List.of());
    }

    /** Returns all tag names that have keyword patterns defined. */
    public static java.util.Set<String> getAllTagNames() {
        return KEYWORDS.keySet();
    }

    /** Returns the full keyword map (read-only view). */
    public static Map<String, List<Pattern>> getAll() {
        return KEYWORDS;
    }

    private static Map<String, List<Pattern>> buildKeywords() {
        Map<String, List<Pattern>> rules = new HashMap<>();

        // ── Atmosphere & Vibe ──
        rules.put("cozy", patterns("cozy", "cosy", "intimate", "warm atmosphere", "snug"));
        rules.put("romantic", patterns("romantic", "date night", "couples", "candlelit", "candle light"));
        rules.put("lively", patterns("lively", "bustling", "energetic", "happening", "buzzy", "vibrant"));
        rules.put("chill", patterns("chill", "laid.?back", "relaxed", "mellow", "low.key", "chilled"));
        rules.put("aesthetic", patterns("aesthetic", "beautiful decor", "beautiful interior", "stylish", "gorgeous"));
        rules.put("trendy", patterns("trendy", "hip", "cool", "fashionable", "insta.*famous", "hottest"));
        rules.put("quiet", patterns("quiet", "peaceful", "serene", "tranquil", "noiseless", "silent", "calm"));
        rules.put("spacious", patterns("spacious", "roomy", "big", "large", "plenty of space", "open space", "airy"));
        rules.put("fine dining", patterns("fine dining", "elegant", "fancy", "upscale", "white tablecloth", "sophisticated"));
        rules.put("casual dining", patterns("casual", "casual dining", "informal", "relaxed dining", "easygoing"));
        rules.put("chic", patterns("chic", "modern", "stylish", "fashionable", "sleek", "minimalist"));
        rules.put("vintage", patterns("vintage", "retro", "antique", "old school", "classic", "nostalgic"));
        rules.put("rustic", patterns("rustic", "traditional", "charming", "old-world", "quaint"));
        rules.put("waterfront", patterns("waterfront", "beachside", "oceanfront", "lakeside", "seaside", "harbor views", "river view"));
        rules.put("garden setting", patterns("garden", "greenery", "plants", "lush", "courtyard", "botanical"));

        // ── Experience ──
        rules.put("sunset views", patterns("sunset", "sunsets", "sun set", "panoramic view", "scenic", "great view", "nice view", "breathtaking"));
        rules.put("outdoor seating", patterns("outdoor", "outdoor seating", "terrace", "patio", "al fresco", "alfresco", "garden seating", "rooftop"));
        rules.put("good for studying", patterns("study", "studying", "get work done", "work here", "good wifi", "good wi-fi", "quiet enough to work", "laptop friendly"));
        rules.put("good for groups", patterns("group", "groups", "gathering", "get together", "party", "large group", "big group"));
        rules.put("late night spot", patterns("late night", "open late", "opens late", "after midnight", "2am", "3am", "4am", "night owl"));
        rules.put("breakfast spot", patterns("breakfast", "brunch", "morning", "early"));
        rules.put("fast service", patterns("fast service", "quick", "speedy", "efficient", "prompt", "no wait", "on point service"));
        rules.put("instagrammable", patterns("instagram", "insta", "photo", "picturesque", "beautiful", "pretty", "snap", "pics", "instagramable"));

        // ── Price & Value ──
        rules.put("budget friendly", patterns("budget", "cheap", "affordable", "reasonably priced", "good value", "inexpensive", "not expensive", "under \\$", "low price"));
        rules.put("pricey", patterns("pricey", "expensive", "overpriced", "costly", "spendy", "premium price", "upscale", "high end"));

        // ── Audience ──
        rules.put("digital nomad friendly", patterns("digital nomad", "remote work", "good wifi", "good wi-fi", "power outlet", "work from", "coworking", "co-working"));
        rules.put("touristy", patterns("tourist", "touristy", "tourist trap", "overrun", "crowded with tourists", "tourist spot"));
        rules.put("local favorite", patterns("local", "locals", "hidden gem", "authentic", "off the beaten path", "underrated"));
        rules.put("family friendly", patterns("family", "kids", "children", "child friendly", "kid friendly", "baby", "stroller"));
        rules.put("pet friendly", patterns("pet", "dog", "dog friendly", "dogs welcome", "pets", "furry"));
        rules.put("hidden gem", patterns("hidden gem", "off the beaten path", "undiscovered", "secret spot", "tucked away"));
        rules.put("solo friendly", patterns("solo", "alone", "single diner", "bar seating", "counter space"));
        rules.put("business friendly", patterns("business meeting", "work lunch", "client dinner", "professional", "formal meeting"));

        // ── Food & Drink ──
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
        rules.put("french food", patterns("french", "bistro", "croissant", "escargot", "coq au vin", "brasserie", "french cuisine"));
        rules.put("italian food", patterns("italian", "pasta", "pizza", "risotto", "lasagna", "gelato", "trattoria", "tiramisu", "italian cuisine"));
        rules.put("mexican food", patterns("mexican", "tacos", "burritos", "quesadilla", "guacamole", "salsa", "enchiladas", "fajitas", "mexican cuisine"));
        rules.put("indian food", patterns("indian", "curry", "naan", "biryani", "tandoori", "tikka masala", "samosa", "paneer", "indian cuisine"));
        rules.put("chinese food", patterns("chinese", "dim sum", "dumplings", "noodles", "peking duck", "wonton", "szechuan", "chinese cuisine"));
        rules.put("korean food", patterns("korean", "bbq", "kimchi", "bibimbap", "bulgogi", "tteokbokki", "soju", "k-fried chicken", "korean cuisine"));
        rules.put("spanish food", patterns("spanish", "tapas", "paella", "churros", "sangria", "patatas bravas", "jamon", "spanish cuisine"));
        rules.put("vietnamese food", patterns("vietnamese", "pho", "banh mi", "spring rolls", "vietnamese coffee", "vietnamese cuisine"));
        rules.put("japanese food", patterns("japanese", "sushi", "sashimi", "maki", "ramen", "tempura", "izakaya", "yakitori", "japanese cuisine"));
        rules.put("middle eastern food", patterns("middle eastern", "hummus", "falafel", "shawarma", "kebab", "baklava", "pita", "middle eastern cuisine"));
        rules.put("mediterranean food", patterns("mediterranean", "greek", "gyros", "souvlaki", "hummus", "olive oil", "feta", "mediterranean cuisine"));
        rules.put("american food", patterns("american", "burgers", "hot dogs", "ribs", "steakhouse", "diner", "american cuisine"));
        rules.put("bakery", patterns("bakery", "bakeries", "croissant", "pastries", "donuts", "cakes", "sweet treats", "bread"));
        rules.put("wine bar", patterns("wine bar", "wine", "wines", "wine list", "sommelier", "chardonnay", "cabernet", "pinot noir"));

        // ── Views & Ambiance ──
        rules.put("beautiful view", patterns("beautiful view", "great view", "nice view", "scenic", "panoramic", "stunning view", "amazing view", "breathtaking view", "city view", "ocean view", "river view"));
        rules.put("live music", patterns("live music", "live band", "dj", "acoustic", "concert", "musician", "jazz", "performance"));

        // ── Non-Food / Miscellaneous Activity & Atmosphere ──
        rules.put("snorkeling", patterns("snorkel", "snorkeling", "snorkelling"));
        rules.put("diving", patterns("diving", "scuba", "scuba diving", "dive"));
        rules.put("surfing", patterns("surf", "surfing", "wave", "waves"));
        rules.put("swimming", patterns("swim", "swimming", "swimming pool", "dip"));
        rules.put("pool", patterns("pool", "swimming pool", "infinity pool"));
        rules.put("boutique hotel", patterns("boutique", "boutique hotel", "boutique stay"));
        rules.put("resort", patterns("resort", "resorts", "luxury resort", "staycation"));
        rules.put("cocktails", patterns("cocktail", "cocktails", "mixologist", "drinks", "martini"));
        rules.put("craft beer", patterns("craft beer", "draft beer", "ipa", "microbrewery", "beers", "local beer"));
        rules.put("rooftop", patterns("rooftop", "roof top", "rooftop bar", "roof deck"));
        rules.put("happy hour", patterns("happy hour", "happy hours", "drink specials"));
        rules.put("night market", patterns("night market", "nightmarket", "evening market"));
        rules.put("street food", patterns("street food", "street snack", "stalls", "food stall", "hawker"));
        rules.put("adventure", patterns("adventure", "activities", "hike", "hiking", "trekking", "thrill", "quad bike", "atv", "zipline"));
        rules.put("cultural", patterns("cultural", "culture", "temple", "heritage", "historical", "history", "museum", "art"));
        rules.put("sightseeing", patterns("sightseeing", "landmark", "monument", "historic site", "attraction", "must-see"));
        rules.put("shopping", patterns("shopping", "boutiques", "souvenirs", "malls", "shops", "stores"));
        rules.put("nature walk", patterns("hiking", "nature walk", "trekking", "forest trail", "mountain climb", "scenic trail"));
        rules.put("nightlife", patterns("clubbing", "nightlife", "dance floor", "dj", "nightclub", "party spot"));
        rules.put("wellness", patterns("spa", "massage", "wellness", "sauna", "relaxation", "yoga", "meditation"));

        return rules;
    }

    private static List<Pattern> patterns(String... keywords) {
        java.util.List<Pattern> result = new java.util.ArrayList<>();
        for (String kw : keywords) {
            result.add(Pattern.compile("\\b" + Pattern.quote(kw.toLowerCase()) + "\\b", Pattern.CASE_INSENSITIVE));
        }
        return result;
    }
}