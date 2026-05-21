package com.radach.maps.controller;

import com.radach.maps.dto.FeedPostRequest;
import com.radach.maps.dto.PostCommentRequest;
import com.radach.maps.model.FeedPost;
import com.radach.maps.model.PostComment;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.FeedPostService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/posts")
public class FeedPostController {

    private final FeedPostService feedPostService;
    private final AuthenticatedUserService authenticatedUserService;

    public FeedPostController(FeedPostService feedPostService, AuthenticatedUserService authenticatedUserService) {
        this.feedPostService = feedPostService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<FeedPost> createPost(@RequestBody FeedPostRequest request, Authentication authentication) {
        Long userId = authenticatedUserService.getUserId(authentication);
        FeedPost post = feedPostService.createPost(userId, request);
        return ResponseEntity.ok(post);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deletePost(@PathVariable Long id, Authentication authentication) {
        Long userId = authenticatedUserService.getUserId(authentication);
        feedPostService.deletePost(id, userId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/like")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Boolean>> toggleLike(@PathVariable Long id, Authentication authentication) {
        Long userId = authenticatedUserService.getUserId(authentication);
        boolean liked = feedPostService.toggleLike(id, userId);
        return ResponseEntity.ok(Map.of("liked", liked));
    }

    @PostMapping("/{id}/comments")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PostComment> addComment(@PathVariable Long id, @RequestBody PostCommentRequest request, Authentication authentication) {
        Long userId = authenticatedUserService.getUserId(authentication);
        PostComment comment = feedPostService.addComment(id, userId, request);
        return ResponseEntity.ok(comment);
    }
}
