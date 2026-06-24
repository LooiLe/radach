package com.radach.maps.service.tagging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

public class KeywordTagGeneratorTest {

    @Test
    public void testFrenchAndThaiMatching() {
        KeywordTagGenerator generator = new KeywordTagGenerator();
        String corpus = "A small, bistro style restaurant with amazing casual fine dining! Chef Tom & chef Rick cook up amazing French food with a subtle Thai twist";

        Map<String, Float> tags = generator.generate(corpus);

        // Verify "thai food" is present
        assertThat(tags).containsKey("thai food");
        assertThat(tags.get("thai food")).isGreaterThanOrEqualTo(0.1f);

        // Verify "french food" is present
        assertThat(tags).containsKey("french food");
        assertThat(tags.get("french food")).isGreaterThanOrEqualTo(0.1f);

        // Verify "fine dining" is present
        assertThat(tags).containsKey("fine dining");
        assertThat(tags.get("fine dining")).isGreaterThanOrEqualTo(0.1f);

        // Verify "casual dining" is present
        assertThat(tags).containsKey("casual dining");
        assertThat(tags.get("casual dining")).isGreaterThanOrEqualTo(0.1f);
    }
}
