package com.radach.maps.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.radach.maps.dto.GenerateItineraryRequest;
import com.radach.maps.dto.GenerationResponse;
import com.radach.maps.dto.PricingResponse;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.ItineraryGenerationService;
import com.radach.maps.service.StripeService;

@RestController
@RequestMapping("/api/v1")
public class ItineraryGenerationController {

    private final ItineraryGenerationService generationService;
    private final StripeService stripeService;
    private final AuthenticatedUserService authenticatedUserService;

    public ItineraryGenerationController(ItineraryGenerationService generationService,
                                          StripeService stripeService,
                                          AuthenticatedUserService authenticatedUserService) {
        this.generationService = generationService;
        this.stripeService = stripeService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @PostMapping("/itineraries/generate")
    public ResponseEntity<GenerationResponse> generate(Authentication auth,
                                                        @RequestBody GenerateItineraryRequest request) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(generationService.initiateGeneration(userId, request));
    }

    @GetMapping("/itineraries/generations")
    public ResponseEntity<List<GenerationResponse>> getMyGenerations(Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(generationService.getMyGenerations(userId));
    }

    @GetMapping("/itineraries/generations/{id}")
    public ResponseEntity<GenerationResponse> getGenerationStatus(Authentication auth, @PathVariable Long id) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(generationService.getGenerationStatus(userId, id));
    }

    @GetMapping("/pricing")
    public ResponseEntity<PricingResponse> getPricing() {
        return ResponseEntity.ok(new PricingResponse(
                stripeService.getItineraryPriceCents(),
                stripeService.getCreditPackSmallCents(),
                stripeService.getCreditPackSmallQty(),
                stripeService.getCreditPackLargeCents(),
                stripeService.getCreditPackLargeQty(),
                "$4.99",
                stripeService.getProGenerationsLimit(),
                "$9.99"
        ));
    }
}
