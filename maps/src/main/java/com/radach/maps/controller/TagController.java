package com.radach.maps.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.SpotResponse;
import com.radach.maps.model.Tag;
import com.radach.maps.service.SpotService;
import com.radach.maps.service.TagService;

@RestController
@RequestMapping("/api/v1/tags")
public class TagController {

    private final TagService tagService;
    private final SpotService spotService;

    public TagController(TagService tagService, SpotService spotService) {
        this.tagService = tagService;
        this.spotService = spotService;
    }

    /** Tag cloud: top N tags by usage. */
    @GetMapping
    public List<TagService.TagCount> getTopTags(
            @RequestParam(defaultValue = "30") int limit
    ) {
        return tagService.getTopTags(Math.min(limit, 100));
    }

    /** Get all tags for a specific spot. */
    @GetMapping("/spot/{spotId}")
    public List<Tag> getTagsForSpot(@PathVariable Long spotId) {
        return tagService.getTagsForSpot(spotId);
    }

    /** Get spots that have a specific tag name. */
    @GetMapping("/{tagName}/spots")
    public List<SpotResponse> getSpotsByTag(@PathVariable String tagName) {
        List<Long> spotIds = tagService.getSpotIdsByTag(tagName);
        if (spotIds.isEmpty()) return List.of();
        var spots = new java.util.ArrayList<>(spotIds.stream()
                .map(id -> {
                    try { return spotService.findById(id, null); }
                    catch (Exception e) { return null; }
                })
                .filter(java.util.Objects::nonNull)
                .toList());
        return spots;
    }
}
