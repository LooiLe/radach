package com.radach.maps.model;

import java.time.Instant;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "feed_posts")
public class FeedPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long authorId;

    @Column(columnDefinition = "text")
    private String content;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "text")
    private List<String> mediaUrls;

    @Convert(converter = LongListConverter.class)
    @Column(columnDefinition = "text")
    private List<Long> spotIds;

    @Convert(converter = LongListConverter.class)
    @Column(columnDefinition = "text")
    private List<Long> eventIds;

    @Convert(converter = LongListConverter.class)
    @Column(columnDefinition = "text")
    private List<Long> journeyIds;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAuthorId() { return authorId; }
    public void setAuthorId(Long authorId) { this.authorId = authorId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public List<String> getMediaUrls() { return mediaUrls; }
    public void setMediaUrls(List<String> mediaUrls) { this.mediaUrls = mediaUrls; }

    public List<Long> getSpotIds() { return spotIds; }
    public void setSpotIds(List<Long> spotIds) { this.spotIds = spotIds; }

    public List<Long> getEventIds() { return eventIds; }
    public void setEventIds(List<Long> eventIds) { this.eventIds = eventIds; }

    public List<Long> getJourneyIds() { return journeyIds; }
    public void setJourneyIds(List<Long> journeyIds) { this.journeyIds = journeyIds; }

    public Instant getCreatedAt() { return createdAt; }
}
