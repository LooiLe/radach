package com.radach.maps.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.TrailPathRequest;
import com.radach.maps.dto.TrailPathResponse;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.Spot;
import com.radach.maps.model.TrailPath;
import com.radach.maps.model.TrailPathDifficulty;
import com.radach.maps.model.TrailPathStatus;
import com.radach.maps.model.User;
import com.radach.maps.repository.SpotRepository;
import com.radach.maps.repository.TrailPathRepository;
import com.radach.maps.repository.TrailPathUpvoteRepository;
import com.radach.maps.repository.UserRepository;

@Service
public class TrailPathService {

    private static final String TRAIL_TYPE = "trail";

    private final TrailPathRepository trailPathRepository;
    private final SpotRepository spotRepository;
    private final UserRepository userRepository;
    private final TrailPathUpvoteRepository trailPathUpvoteRepository;

    public TrailPathService(TrailPathRepository trailPathRepository,
                            SpotRepository spotRepository,
                            UserRepository userRepository,
                            TrailPathUpvoteRepository trailPathUpvoteRepository) {
        this.trailPathRepository = trailPathRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.trailPathUpvoteRepository = trailPathUpvoteRepository;
    }

    /**
     * Get all public ACTIVE paths for a spot. If the current user is provided,
     * also include their private paths and their own pending/rejected paths.
     */
    public List<TrailPathResponse> getPathsForSpot(Long spotId, Long currentUserId) {
        List<TrailPath> activePaths = trailPathRepository
                .findBySpotIdAndStatusAndIsPrivateFalseOrderByUpvoteCountDescCreatedAtDesc(spotId, TrailPathStatus.ACTIVE);

        if (currentUserId != null) {
            List<TrailPath> allPathsForSpot = trailPathRepository.findAll().stream()
                    .filter(p -> spotId.equals(p.getSpotId()))
                    .toList();

            List<TrailPath> merged = allPathsForSpot.stream()
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

    /**
     * Get a single path by ID.
     */
    public TrailPathResponse getPath(Long id, Long currentUserId) {
        TrailPath path = trailPathRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trail path not found"));

        // If private, only the owner can view it
        if (path.isPrivate() && (currentUserId == null || !currentUserId.equals(path.getSubmittedBy()))) {
            throw new ResourceNotFoundException("Trail path not found");
        }

        return toResponse(path, currentUserId);
    }

    /**
     * Submit a new trail path. Admins get ACTIVE status, regular users get PENDING.
     */
    @Transactional
    public TrailPathResponse submitPath(TrailPathRequest request, Long userId, boolean isAdmin) {
        TrailPath path = new TrailPath();
        
        // Handle optional spotId
        if (request.spotId() != null) {
            Spot spot = spotRepository.findById(request.spotId())
                    .orElseThrow(() -> new ResourceNotFoundException("Spot not found"));
            
            // Validate this is a trail-type spot
            if (!isTrailSpot(spot)) {
                throw new IllegalArgumentException("Trail paths can only be submitted for trail-type spots");
            }
            path.setSpotId(request.spotId());
        }
        
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

        path = trailPathRepository.save(path);
        return toResponse(path, userId);
    }

    /**
     * Update an existing trail path. Only the owner or an admin can update.
     */
    @Transactional
    public TrailPathResponse updatePath(Long id, TrailPathRequest request, Long userId, boolean isAdmin) {
        TrailPath path = trailPathRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trail path not found"));

        if (!isAdmin && (path.getSubmittedBy() == null || !path.getSubmittedBy().equals(userId))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    "You can only edit your own trail paths"
            );
        }

        // Delete removed photos from disk
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

        // Non-admin edits reset status to PENDING for re-approval
        if (!isAdmin) {
            path.setStatus(TrailPathStatus.PENDING);
        }

        path = trailPathRepository.save(path);
        return toResponse(path, userId);
    }

    /**
     * Delete a trail path. Only the owner or an admin can delete.
     */
    @Transactional
    public void deletePath(Long id, Long userId, boolean isAdmin) {
        TrailPath path = trailPathRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trail path not found"));

        if (!isAdmin && (path.getSubmittedBy() == null || !path.getSubmittedBy().equals(userId))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    "You can only delete your own trail paths"
            );
        }

        // Delete associated photos from disk
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

        trailPathRepository.delete(path);
    }

    /**
     * Get a user's own submitted paths.
     */
    public List<TrailPathResponse> getMySubmissions(Long userId) {
        return trailPathRepository.findBySubmittedByOrderByCreatedAtDesc(userId)
                .stream().map(p -> toResponse(p, userId)).toList();
    }

    /**
     * Admin: get all pending paths for moderation.
     */
    public List<TrailPathResponse> getPendingPaths() {
        return trailPathRepository.findByStatusOrderByCreatedAtAsc(TrailPathStatus.PENDING)
                .stream().map(p -> toResponse(p, null)).toList();
    }

    /**
     * Admin: update path status (approve/reject).
     */
    @Transactional
    public TrailPathResponse updatePathStatus(Long id, TrailPathStatus status) {
        TrailPath path = trailPathRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trail path not found"));
        path.setStatus(status);
        path = trailPathRepository.save(path);
        return toResponse(path, null);
    }

    /**
     * Toggle upvote for a path by a user.
     */
    @Transactional
    public TrailPathResponse toggleUpvote(Long pathId, Long userId) {
        TrailPath path = trailPathRepository.findById(pathId)
                .orElseThrow(() -> new ResourceNotFoundException("Trail path not found"));

        if (path.isPrivate() && !userId.equals(path.getSubmittedBy())) {
            throw new ResourceNotFoundException("Trail path not found");
        }

        java.util.Optional<com.radach.maps.model.TrailPathUpvote> existing = trailPathUpvoteRepository.findByUserIdAndPathId(userId, pathId);
        
        if (existing.isPresent()) {
            trailPathUpvoteRepository.delete(existing.get());
            path.setUpvoteCount(Math.max(0, path.getUpvoteCount() - 1));
        } else {
            com.radach.maps.model.TrailPathUpvote upvote = new com.radach.maps.model.TrailPathUpvote();
            upvote.setUserId(userId);
            upvote.setPathId(pathId);
            trailPathUpvoteRepository.save(upvote);
            path.setUpvoteCount(path.getUpvoteCount() + 1);
        }

        path = trailPathRepository.save(path);
        return toResponse(path, userId);
    }

    // --- Helpers ---

    private boolean isTrailSpot(Spot spot) {
        if (spot.getType() == null) return false;
        return spot.getType().trim().equalsIgnoreCase(TRAIL_TYPE);
    }

    private TrailPathResponse toResponse(TrailPath path, Long currentUserId) {
        String spotName = null;
        if (path.getSpotId() != null) {
            spotName = spotRepository.findById(path.getSpotId())
                    .map(Spot::getName).orElse(null);
        }

        String submitterName = null;
        if (path.getSubmittedBy() != null) {
            submitterName = userRepository.findById(path.getSubmittedBy())
                    .map(User::getName).orElse(null);
        }

        boolean isUpvoted = false;
        if (currentUserId != null) {
            isUpvoted = trailPathUpvoteRepository.existsByUserIdAndPathId(currentUserId, path.getId());
        }

        return new TrailPathResponse(
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
                null,
                null
        );
    }
}
