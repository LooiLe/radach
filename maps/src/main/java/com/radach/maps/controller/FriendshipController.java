package com.radach.maps.controller;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.model.Friendship;
import com.radach.maps.model.User;
import com.radach.maps.repository.UserRepository;
import com.radach.maps.service.FriendshipService;

@RestController
@RequestMapping("/api/v1/friends")
public class FriendshipController {

    private final FriendshipService friendshipService;
    private final UserRepository userRepository;

    public FriendshipController(FriendshipService friendshipService, UserRepository userRepository) {
        this.friendshipService = friendshipService;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new IllegalArgumentException("User not authenticated");
        }
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getFriends(Authentication auth) {
        User user = getAuthenticatedUser(auth);
        Set<Long> friendIds = friendshipService.getFirstDegreeConnections(user.getId());
        List<Map<String, Object>> friends = userRepository.findAllById(friendIds).stream()
                .map(u -> Map.<String, Object>of("id", u.getId(), "name", u.getName(), "email", u.getEmail()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(friends);
    }

    @GetMapping("/requests")
    public ResponseEntity<List<Map<String, Object>>> getPendingRequests(Authentication auth) {
        User user = getAuthenticatedUser(auth);
        List<Friendship> requests = friendshipService.getPendingRequestsForMe(user.getId());
        List<Map<String, Object>> response = requests.stream()
                .map(req -> {
                    User requester = userRepository.findById(req.getRequesterId()).orElse(null);
                    return Map.<String, Object>of(
                            "id", req.getId(),
                            "requesterId", req.getRequesterId(),
                            "requesterName", requester != null ? requester.getName() : "Unknown",
                            "status", req.getStatus()
                    );
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/request/{addresseeId}")
    public ResponseEntity<Friendship> sendRequest(@PathVariable Long addresseeId, Authentication auth) {
        User user = getAuthenticatedUser(auth);
        return ResponseEntity.ok(friendshipService.sendRequest(user.getId(), addresseeId));
    }

    @PostMapping("/accept/{friendshipId}")
    public ResponseEntity<Friendship> acceptRequest(@PathVariable Long friendshipId, Authentication auth) {
        User user = getAuthenticatedUser(auth);
        return ResponseEntity.ok(friendshipService.acceptRequest(user.getId(), friendshipId));
    }

    @DeleteMapping("/{friendshipId}")
    public ResponseEntity<Void> rejectOrCancelRequest(@PathVariable Long friendshipId, Authentication auth) {
        User user = getAuthenticatedUser(auth);
        friendshipService.rejectOrCancelRequest(user.getId(), friendshipId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/search-users")
    public ResponseEntity<List<Map<String, Object>>> searchUsers(@org.springframework.web.bind.annotation.RequestParam String query, Authentication auth) {
        User currentUser = getAuthenticatedUser(auth);
        List<User> found = userRepository.searchByNameOrEmail(query);
        List<Map<String, Object>> response = found.stream()
                .filter(u -> !u.getId().equals(currentUser.getId()))
                .map(u -> Map.<String, Object>of(
                        "id", u.getId(),
                        "name", u.getName(),
                        "email", u.getEmail()
                ))
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }
}
