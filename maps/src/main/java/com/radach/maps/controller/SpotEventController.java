package com.radach.maps.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.SpotEvent;
import com.radach.maps.model.SpotEvent.EventType;
import com.radach.maps.repository.SpotEventRepository;
import com.radach.maps.repository.SpotRepository;
import com.radach.maps.service.AuthenticatedUserService;

@RestController
@RequestMapping("/api/v1/spots/{spotId}")
public class SpotEventController {

    private final SpotEventRepository spotEventRepository;
    private final SpotRepository spotRepository;
    private final AuthenticatedUserService authenticatedUserService;

    public SpotEventController(SpotEventRepository spotEventRepository, SpotRepository spotRepository,
                               AuthenticatedUserService authenticatedUserService) {
        this.spotEventRepository = spotEventRepository;
        this.spotRepository = spotRepository;
        this.authenticatedUserService = authenticatedUserService;
    }

    @PostMapping("/view")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void trackView(@PathVariable Long spotId, Authentication auth) {
        validateSpotExists(spotId);
        SpotEvent event = new SpotEvent();
        event.setSpotId(spotId);
        event.setEventType(EventType.VIEW);
        event.setUserId(getUserIdOrNull(auth));
        spotEventRepository.save(event);
    }

    private Long getUserIdOrNull(Authentication auth) {
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            try {
                return authenticatedUserService.getUserId(auth);
            } catch (Exception e) {
                // ignore — anonymous view is fine
            }
        }
        return null;
    }

    private void validateSpotExists(Long spotId) {
        if (!spotRepository.existsById(spotId)) {
            throw new ResourceNotFoundException("Spot not found");
        }
    }
}