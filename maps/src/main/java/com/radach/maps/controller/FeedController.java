package com.radach.maps.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.FeedService;

@RestController
@RequestMapping("/api/v1/feed")
public class FeedController {

    private final FeedService feedService;
    private final AuthenticatedUserService authenticatedUserService;

    public FeedController(FeedService feedService, AuthenticatedUserService authenticatedUserService) {
        this.feedService = feedService;
        this.authenticatedUserService = authenticatedUserService;
    }

    /**
     * Get the friend activity feed for the authenticated user.
     * Returns recent reviews, likes, saves, and views from friends.
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<FeedService.FeedItem> getFeed(
            Authentication auth,
            @RequestParam(defaultValue = "30") int limit
    ) {
        Long userId = authenticatedUserService.getUserId(auth);
        return feedService.getFeed(userId, Math.min(limit, 100));
    }
}
