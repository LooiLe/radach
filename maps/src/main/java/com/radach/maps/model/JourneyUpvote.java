package com.radach.maps.model;

import jakarta.persistence.*;

@Entity
@Table(name = "journey_upvotes", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "journey_id"}))
public class JourneyUpvote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "journey_id", nullable = false)
    private Long journeyId;

    public Long getId() { return id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Long getJourneyId() { return journeyId; }
    public void setJourneyId(Long journeyId) { this.journeyId = journeyId; }
}