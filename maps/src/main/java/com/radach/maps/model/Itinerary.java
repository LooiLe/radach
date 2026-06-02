package com.radach.maps.model;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "itineraries")
public class Itinerary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ItineraryStatus status = ItineraryStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ItinerarySource source = ItinerarySource.MANUAL;

    @Column(name = "generation_preferences", columnDefinition = "text")
    private String generationPreferences;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    // --- Getters & Setters ---

    public Long getId() { return id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public ItineraryStatus getStatus() { return status; }
    public void setStatus(ItineraryStatus status) { this.status = status; }

    public ItinerarySource getSource() { return source; }
    public void setSource(ItinerarySource source) { this.source = source; }

    public String getGenerationPreferences() { return generationPreferences; }
    public void setGenerationPreferences(String generationPreferences) { this.generationPreferences = generationPreferences; }

    public Instant getCreatedAt() { return createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
}
