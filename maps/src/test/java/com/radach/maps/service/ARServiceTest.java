package com.radach.maps.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.ARAnnotationRequest;
import com.radach.maps.dto.ARAnnotationResponse;
import com.radach.maps.dto.SpotResponse;
import com.radach.maps.dto.SpotRequest;
import com.radach.maps.model.Role;
import com.radach.maps.model.User;
import com.radach.maps.model.SpotStatus;
import com.radach.maps.repository.UserRepository;
import com.radach.maps.repository.ARAnnotationRepository;
import com.radach.maps.repository.SpotRepository;
import com.radach.maps.repository.ReviewRepository;
import com.radach.maps.model.Review;

@SpringBootTest
@Transactional
@ActiveProfiles("test")
public class ARServiceTest {

    @Autowired
    private ARService arService;

    @Autowired
    private CreditService creditService;

    @Autowired
    private SpotService spotService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ARAnnotationRepository arAnnotationRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    private User user;
    private User admin;
    private User expert;

    @BeforeEach
    public void setUp() {
        arAnnotationRepository.deleteAll();
        reviewRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("hash");
        user.setName("AR User");
        user.setRole(Role.USER);
        user = userRepository.saveAndFlush(user);

        admin = new User();
        admin.setEmail("admin@example.com");
        admin.setPasswordHash("hash");
        admin.setName("AR Admin");
        admin.setRole(Role.ADMIN);
        admin = userRepository.saveAndFlush(admin);

        expert = new User();
        expert.setEmail("expert@example.com");
        expert.setPasswordHash("hash");
        expert.setName("Expert Critic");
        expert.setRole(Role.USER);
        expert.setExpert(true);
        expert = userRepository.saveAndFlush(expert);
    }

    @Test
    public void testPinToEarnApprovalLoop() {
        // Arrange: User submits a pending annotation
        ARAnnotationRequest req = new ARAnnotationRequest(
            13.756,
            100.501,
            90.0, // bearing
            null, // pitch
            "Historical Mural", // title
            "This is a detailed historical wall mural.", // description
            "http://example.com/mural.jpg", // photoUrl
            15.0 // radiusMeters
        );
        ARAnnotationResponse pending = arService.submitAnnotation(user.getId(), req);
        assertThat(pending.status()).isEqualTo("PENDING");
        assertThat(creditService.getBalance(user.getId())).isEqualTo(0);

        // Act: Admin approves the annotation
        ARAnnotationResponse approved = arService.reviewAnnotation(pending.id(), "approve", admin.getId(), "Looks good!");
        assertThat(approved.status()).isEqualTo("APPROVED");

        // Assert: User gets 1 credit added
        assertThat(creditService.getBalance(user.getId())).isEqualTo(1);

        // Act & Assert: Re-moderating does not double reward (idempotency check)
        arService.reviewAnnotation(pending.id(), "approve", admin.getId(), "Review again");
        assertThat(creditService.getBalance(user.getId())).isEqualTo(1);
    }

    @Test
    public void testExpertSpotlightFilter() {
        // Arrange: Create a spot
        SpotResponse spot = spotService.create(new SpotRequest(
            "Expert Recommended Spot", "Cafe", "789 Cafe Rd", 13.756, 100.501, List.of("cafe"), List.of(), null, SpotStatus.ACTIVE
        ), true, admin.getId());

        // Create an approved review by the expert
        Review review = new Review();
        review.setSpotId(spot.id());
        review.setAuthorId(expert.getId());
        review.setRating(5.0);
        review.setBody("Exceptional coffee!");
        review.setReviewType(Review.ReviewType.EXPERT);
        review.setStatus(Review.Status.APPROVED);
        reviewRepository.saveAndFlush(review);

        // Act: Search nearby spots filtered by expertId
        List<SpotResponse> nearbySpots = arService.findNearbySpotsByExpert(
            13.756, 100.501, expert.getId(), 500, List.of()
        );

        // Assert: The expert-reviewed spot is found
        assertThat(nearbySpots).hasSize(1);
        assertThat(nearbySpots.get(0).id()).isEqualTo(spot.id());

        // Search with a different expert id (no spots reviewed)
        List<SpotResponse> otherNearby = arService.findNearbySpotsByExpert(
            13.756, 100.501, user.getId(), 500, List.of()
        );
        assertThat(otherNearby).isEmpty();
    }
}
