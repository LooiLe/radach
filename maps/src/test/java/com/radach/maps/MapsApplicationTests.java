package com.radach.maps;

import static org.assertj.core.api.Assertions.assertThat;

import com.radach.maps.model.Spot;
import com.radach.maps.model.SpotStatus;
import com.radach.maps.repository.SpotRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@SpringBootTest
class MapsApplicationTests {

	@Autowired
	private SpotRepository spotRepository;

	@BeforeEach
	void setUp() {
		spotRepository.deleteAll();
	}

	@Test
	void contextLoads() {
	}

	@Test
	void findsSpotsWithinRadius() {
		Spot nearby = new Spot();
		nearby.setName("Central Park");
		nearby.setType("park");
		nearby.setAddress("New York, NY");
		nearby.setLatitude(40.785091);
		nearby.setLongitude(-73.968285);
		nearby.setTags(List.of("green", "walk"));
		nearby.setStatus(SpotStatus.ACTIVE);

		Spot farAway = new Spot();
		farAway.setName("Golden Gate Park");
		farAway.setType("park");
		farAway.setAddress("San Francisco, CA");
		farAway.setLatitude(37.769421);
		farAway.setLongitude(-122.486214);
		farAway.setTags(List.of("green"));
		farAway.setStatus(SpotStatus.ACTIVE);

		spotRepository.saveAll(List.of(nearby, farAway));

		List<Spot> results = spotRepository.findWithinRadius(40.7812, -73.9665, 5.0);

		assertThat(results)
				.extracting(Spot::getName)
				.containsExactly("Central Park");
	}

}
