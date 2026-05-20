package com.radach.maps.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "spot_vibe_tags")
public class SpotVibeTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long spotId;

    @Column(nullable = false)
    private Long vibeTagId;

    @Column(nullable = false)
    private Float confidence = 0.0f;

    @Column(nullable = false, length = 20)
    private String source = "keyword";

    @Column(nullable = false)
    private Instant lastUpdated;

    @PrePersist
    @PreUpdate
    void onUpdate() {
        lastUpdated = Instant.now();
    }

    public SpotVibeTag() {}

    public SpotVibeTag(Long spotId, Long vibeTagId, Float confidence, String source) {
        this.spotId = spotId;
        this.vibeTagId = vibeTagId;
        this.confidence = confidence;
        this.source = source;
    }

    public Long getId() { return id; }

    public Long getSpotId() { return spotId; }
    public void setSpotId(Long spotId) { this.spotId = spotId; }

    public Long getVibeTagId() { return vibeTagId; }
    public void setVibeTagId(Long vibeTagId) { this.vibeTagId = vibeTagId; }

    public Float getConfidence() { return confidence; }
    public void setConfidence(Float confidence) { this.confidence = confidence; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public Instant getLastUpdated() { return lastUpdated; }
}