package com.radach.maps.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "journeys")
public class Journey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "spot_id")
    private Long spotId;

    @Column(name = "submitted_by")
    private Long submittedBy;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TrailPathDifficulty difficulty = TrailPathDifficulty.MODERATE;

    @Column(name = "estimated_duration_min")
    private Integer estimatedDurationMin;

    @Column(name = "distance_meters")
    private Double distanceMeters;

    @Column(name = "geo_json", nullable = false, columnDefinition = "text")
    private String geoJson;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "text")
    private List<String> photos = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TrailPathStatus status = TrailPathStatus.PENDING;

    @Column(name = "is_private", nullable = false)
    private boolean isPrivate = false;

    @Column(name = "upvote_count", nullable = false)
    private int upvoteCount = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "journey_category_id", nullable = false)
    private Long journeyCategoryId;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }

    public Long getSpotId() { return spotId; }
    public void setSpotId(Long spotId) { this.spotId = spotId; }

    public Long getSubmittedBy() { return submittedBy; }
    public void setSubmittedBy(Long submittedBy) { this.submittedBy = submittedBy; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public TrailPathDifficulty getDifficulty() { return difficulty; }
    public void setDifficulty(TrailPathDifficulty difficulty) { this.difficulty = difficulty; }

    public Integer getEstimatedDurationMin() { return estimatedDurationMin; }
    public void setEstimatedDurationMin(Integer estimatedDurationMin) { this.estimatedDurationMin = estimatedDurationMin; }

    public Double getDistanceMeters() { return distanceMeters; }
    public void setDistanceMeters(Double distanceMeters) { this.distanceMeters = distanceMeters; }

    public String getGeoJson() { return geoJson; }
    public void setGeoJson(String geoJson) { this.geoJson = geoJson; }

    public List<String> getPhotos() { return photos; }
    public void setPhotos(List<String> photos) { this.photos = photos; }

    public TrailPathStatus getStatus() { return status; }
    public void setStatus(TrailPathStatus status) { this.status = status; }

    public boolean isPrivate() { return isPrivate; }
    public void setPrivate(boolean isPrivate) { this.isPrivate = isPrivate; }

    public int getUpvoteCount() { return upvoteCount; }
    public void setUpvoteCount(int upvoteCount) { this.upvoteCount = upvoteCount; }

    public Instant getCreatedAt() { return createdAt; }

    public Long getJourneyCategoryId() { return journeyCategoryId; }
    public void setJourneyCategoryId(Long journeyCategoryId) { this.journeyCategoryId = journeyCategoryId; }

}
