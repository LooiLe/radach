package com.radach.maps.dto;

import java.util.List;

public record FeedPostRequest(
        String content,
        List<String> mediaUrls,
        Long spotId,
        Long eventId,
        Long journeyId
) {}
