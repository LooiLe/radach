package com.radach.maps.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.JourneyRequest;
import com.radach.maps.dto.JourneyResponse;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.Journey;
import com.radach.maps.model.JourneyCategory;
import com.radach.maps.model.Spot;
import com.radach.maps.model.TrailPathDifficulty;
import com.radach.maps.model.TrailPathStatus;
import com.radach.maps.model.User;
import com.radach.maps.repository.JourneyCategoryRepository;
import com.radach.maps.repository.JourneyRepository;
import com.radach.maps.repository.JourneyUpvoteRepository;
import com.radach.maps.repository.SpotRepository;
import com.radach.maps.repository.UserRepository;

@Service
public class JourneyService {

    private static final String TRAIL_TYPE = "trail";

    private final JourneyRepository journeyRepository;
    private final SpotRepository spotRepository;
    private final UserRepository userRepository;
    private final JourneyUpvoteRepository journeyUpvoteRepository;
    private final JourneyCategoryRepository journeyCategoryRepository;

    public JourneyService(JourneyRepository journeyRepository,
                          SpotRepository spotRepository,
                          UserRepository userRepository,
                          JourneyUpvoteRepository journeyUpvoteRepository,
                          JourneyCategoryRepository journeyCategoryRepository) {
        this.journeyRepository = journeyRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.journeyUpvoteRepository = journeyUpvoteRepository;
        this.journeyCategoryRepository = journeyCategoryRepository;
    }

    public List<JourneyResponse> getPathsForSpot(Long spotId, Long currentUserId) {
        List<Journey> activePaths = journeyRepository
                .findBySpotIdAndStatusAndIsPrivateFalseOrderByUpvoteCountDescCreatedAtDesc(spotId, TrailPathStatus.ACTIVE);

        if (currentUserId != null) {
            List<Journey> allPathsForSpot = journeyRepository.findAll().stream()
                    .filter(p -> spotId.equals(p.getSpotId()))
                    .toList();

            List<Journey> merged = allPathsForSpot.stream()
                    .filter(p -> {
                        boolean isOwner = p.getSubmittedBy() != null && p.getSubmittedBy().equals(currentUserId);
                        if (p.getStatus() == TrailPathStatus.ACTIVE) {
                            return !p.isPrivate() || isOwner;
                        }
                        return isOwner;
                    })
                    .sorted((a, b) -> {
                        if (a.getStatus() != b.getStatus()) {
                            if (a.getStatus() == TrailPathStatus.ACTIVE) return -1;
                            if (b.getStatus() == TrailPathStatus.ACTIVE) return 1;
                        }
                        int upvoteCompare = Integer.compare(b.getUpvoteCount(), a.getUpvoteCount());
                        if (upvoteCompare != 0) return upvoteCompare;
                        return b.getCreatedAt().compareTo(a.getCreatedAt());
                    })
                    .toList();
            return merged.stream().map(p -> toResponse(p, currentUserId)).toList();
        }

        return activePaths.stream().map(p -> toResponse(p, currentUserId)).toList();
    }

    public JourneyResponse getPath(Long id, Long currentUserId) {
        Journey path = journeyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Journey not found"));

        if (path.isPrivate() && (currentUserId == null || !currentUserId.equals(path.getSubmittedBy()))) {
            throw new ResourceNotFoundException("Journey not found");
        }

        return toResponse(path, currentUserId);
    }

    @Transactional
    public JourneyResponse submitPath(JourneyRequest request, Long userId, boolean isAdmin) {
        Journey path = new Journey();

        // Validate journey category exists
        JourneyCategory category = journeyCategoryRepository.findById(request.journeyCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Journey category not found"));

        // Handle optional spotId
        if (request.spotId() != null) {
            Spot spot = spotRepository.findById(request.spotId())
                    .orElseThrow(() -> new ResourceNotFoundException("Spot not found"));

            if (!isTrailSpot(spot)) {
                throw new IllegalArgumentException("Journeys can only be submitted for trail-type spots");
            }
            path.setSpotId(request.spotId());
        }

        path.setJourneyCategoryId(request.journeyCategoryId());
        path.setSubmittedBy(userId);
        path.setName(request.name());
        path.setDescription(request.description());
        path.setGeoJson(request.geoJson());
        path.setDistanceMeters(request.distanceMeters());
        path.setEstimatedDurationMin(request.estimatedDurationMin());
        path.setPhotos(request.photos() != null ? request.photos() : new java.util.ArrayList<>());
        path.setPrivate(request.isPrivate() != null && request.isPrivate());
        path.setStatus(isAdmin ? TrailPathStatus.ACTIVE : TrailPathStatus.PENDING);

        if (request.difficulty() != null) {
            try {
                path.setDifficulty(TrailPathDifficulty.valueOf(request.difficulty().toUpperCase()));
            } catch (IllegalArgumentException e) {
                path.setDifficulty(TrailPathDifficulty.MODERATE);
            }
        }

        path = journeyRepository.save(path);
        return toResponse(path, userId);
    }

    @Transactional
    public JourneyResponse updatePath(Long id, JourneyRequest request, Long userId, boolean isAdmin) {
        Journey path = journeyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Journey not found"));

        if (!isAdmin && (path.getSubmittedBy() == null || !path.getSubmittedBy().equals(userId))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    "You can only edit your own journeys"
            );
        }

        List<String> oldPhotos = path.getPhotos() == null ? List.of() : path.getPhotos();
        List<String> newPhotos = request.photos() == null ? List.of() : request.photos();
        for (String oldPhoto : oldPhotos) {
            if (!newPhotos.contains(oldPhoto) && oldPhoto != null && oldPhoto.startsWith("/uploads/")) {
                String filename = oldPhoto.substring("/uploads/".length());
                if (!filename.contains("..") && !filename.contains("/") && !filename.contains("\\")) {
                    try {
                        java.nio.file.Files.deleteIfExists(java.nio.file.Paths.get("uploads").resolve(filename));
                    } catch (java.io.IOException e) {
                        System.err.println("Failed to delete removed photo: " + oldPhoto);
                    }
                }
            }
        }

        path.setJourneyCategoryId(request.journeyCategoryId());
        path.setName(request.name());
        path.setDescription(request.description());
        path.setGeoJson(request.geoJson());
        path.setDistanceMeters(request.distanceMeters());
        path.setEstimatedDurationMin(request.estimatedDurationMin());
        path.setPhotos(request.photos() != null ? request.photos() : new java.util.ArrayList<>());
        path.setPrivate(request.isPrivate() != null && request.isPrivate());

        if (request.difficulty() != null) {
            try {
                path.setDifficulty(TrailPathDifficulty.valueOf(request.difficulty().toUpperCase()));
            } catch (IllegalArgumentException e) {
                // Keep existing difficulty
            }
        }

        if (!isAdmin) {
            path.setStatus(TrailPathStatus.PENDING);
        }

        path = journeyRepository.save(path);
        return toResponse(path, userId);
    }

    @Transactional
    public void deletePath(Long id, Long userId, boolean isAdmin) {
        Journey path = journeyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Journey not found"));

        if (!isAdmin && (path.getSubmittedBy() == null || !path.getSubmittedBy().equals(userId))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    "You can only delete your own journeys"
            );
        }

        if (path.getPhotos() != null) {
            java.nio.file.Path uploadDir = java.nio.file.Paths.get("uploads");
            for (String photoUrl : path.getPhotos()) {
                if (photoUrl != null && photoUrl.startsWith("/uploads/")) {
                    String filename = photoUrl.substring("/uploads/".length());
                    if (!filename.contains("..") && !filename.contains("/") && !filename.contains("\\")) {
                        try {
                            java.nio.file.Files.deleteIfExists(uploadDir.resolve(filename));
                        } catch (java.io.IOException e) {
                            System.err.println("Failed to delete photo: " + photoUrl);
                        }
                    }
                }
            }
        }

        journeyRepository.delete(path);
    }

    public List<JourneyResponse> getAllJourneys(Long currentUserId) {
        List<Journey> activeJourneys = journeyRepository
                .findByStatusAndIsPrivateFalseOrderByCreatedAtDesc(TrailPathStatus.ACTIVE);
        return activeJourneys.stream().map(p -> toResponse(p, currentUserId)).toList();
    }

    public List<JourneyResponse> getMySubmissions(Long userId) {
        return journeyRepository.findBySubmittedByOrderByCreatedAtDesc(userId)
                .stream().map(p -> toResponse(p, userId)).toList();
    }

    public List<JourneyResponse> getPendingPaths() {
        return journeyRepository.findByStatusOrderByCreatedAtAsc(TrailPathStatus.PENDING)
                .stream().map(p -> toResponse(p, null)).toList();
    }

    @Transactional
    public JourneyResponse updatePathStatus(Long id, TrailPathStatus status) {
        Journey path = journeyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Journey not found"));
        path.setStatus(status);
        path = journeyRepository.save(path);
        return toResponse(path, null);
    }

    @Transactional
    public JourneyResponse toggleUpvote(Long pathId, Long userId) {
        Journey path = journeyRepository.findById(pathId)
                .orElseThrow(() -> new ResourceNotFoundException("Journey not found"));

        if (path.isPrivate() && !userId.equals(path.getSubmittedBy())) {
            throw new ResourceNotFoundException("Journey not found");
        }

        java.util.Optional<com.radach.maps.model.JourneyUpvote> existing = journeyUpvoteRepository.findByUserIdAndJourneyId(userId, pathId);

        if (existing.isPresent()) {
            journeyUpvoteRepository.delete(existing.get());
            path.setUpvoteCount(Math.max(0, path.getUpvoteCount() - 1));
        } else {
            com.radach.maps.model.JourneyUpvote upvote = new com.radach.maps.model.JourneyUpvote();
            upvote.setUserId(userId);
            upvote.setJourneyId(pathId);
            journeyUpvoteRepository.save(upvote);
            path.setUpvoteCount(path.getUpvoteCount() + 1);
        }

        path = journeyRepository.save(path);
        return toResponse(path, userId);
    }

    private boolean isTrailSpot(Spot spot) {
        if (spot.getType() == null) return false;
        return spot.getType().trim().equalsIgnoreCase(TRAIL_TYPE);
    }

    private JourneyResponse toResponse(Journey path, Long currentUserId) {
        String spotName = null;
        if (path.getSpotId() != null) {
            spotName = spotRepository.findById(path.getSpotId())
                    .map(Spot::getName).orElse(null);
        }

        String categoryName = null;
        if (path.getJourneyCategoryId() != null) {
            categoryName = journeyCategoryRepository.findById(path.getJourneyCategoryId())
                    .map(JourneyCategory::getName).orElse(null);
        }

        String submitterName = null;
        if (path.getSubmittedBy() != null) {
            submitterName = userRepository.findById(path.getSubmittedBy())
                    .map(User::getName).orElse(null);
        }

        boolean isUpvoted = false;
        if (currentUserId != null) {
            isUpvoted = journeyUpvoteRepository.existsByUserIdAndJourneyId(currentUserId, path.getId());
        }

        return new JourneyResponse(
                path.getId(),
                path.getSpotId(),
                spotName,
                path.getSubmittedBy(),
                submitterName,
                path.getName(),
                path.getDescription(),
                path.getDifficulty().name(),
                path.getEstimatedDurationMin(),
                path.getDistanceMeters(),
                path.getGeoJson(),
                path.getPhotos(),
                path.getStatus().name(),
                path.isPrivate(),
                path.getUpvoteCount(),
                isUpvoted,
                path.getCreatedAt(),
                path.getJourneyCategoryId(),
                categoryName
        );
    }
}