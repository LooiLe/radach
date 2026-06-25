package com.radach.maps.dto;

import java.util.List;

public record FeedPostRequest(
        String content,
        List<String> mediaUrls,
        List<Long> spotIds,
        List<Long> eventIds,
        List<Long> journeyIds
) {}