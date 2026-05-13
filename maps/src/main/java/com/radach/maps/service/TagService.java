package com.radach.maps.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.model.Tag;
import com.radach.maps.repository.TagRepository;

@Service
public class TagService {

    private final TagRepository tagRepository;

    public TagService(TagRepository tagRepository) {
        this.tagRepository = tagRepository;
    }

    /**
     * Get-or-create a tag by name.
     */
    @Transactional
    public Tag getOrCreate(String name) {
        String normalized = name.trim().toLowerCase();
        return tagRepository.findByName(normalized)
                .orElseGet(() -> tagRepository.save(new Tag(normalized)));
    }

    /**
     * Top N tags by usage (tag cloud).
     */
    public List<TagCount> getTopTags(int limit) {
        return tagRepository.findTopTags(limit).stream()
                .map(row -> new TagCount((String) row[0], ((Number) row[1]).longValue()))
                .toList();
    }

    /**
     * All tags for a given spot.
     */
    public List<Tag> getTagsForSpot(Long spotId) {
        return tagRepository.findBySpotId(spotId);
    }

    /**
     * All spot IDs that have a given tag.
     */
    public List<Long> getSpotIdsByTag(String tagName) {
        return tagRepository.findSpotIdsByTagName(tagName.trim().toLowerCase());
    }

    public record TagCount(String name, long count) {}
}
