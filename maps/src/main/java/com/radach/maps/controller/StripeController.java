package com.radach.maps.controller;

import java.util.Comparator;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.radach.maps.model.SubscriptionStatus;
import com.radach.maps.model.SubscriptionTier;
import com.radach.maps.model.UserSubscription;
import com.radach.maps.repository.UserSubscriptionRepository;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.CreditService;
import com.radach.maps.service.ItineraryGenerationService;
import com.radach.maps.service.StripeService;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.Invoice;
import com.stripe.model.StripeObject;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;

@RestController
@RequestMapping("/api/v1")
public class StripeController {

    private static final Logger log = LoggerFactory.getLogger(StripeController.class);

    private final StripeService stripeService;
    private final CreditService creditService;
    private final ItineraryGenerationService generationService;
    private final UserSubscriptionRepository subscriptionRepository;
    private final AuthenticatedUserService authenticatedUserService;

    public StripeController(StripeService stripeService,
                            CreditService creditService,
                            ItineraryGenerationService generationService,
                            UserSubscriptionRepository subscriptionRepository,
                            AuthenticatedUserService authenticatedUserService) {
        this.stripeService = stripeService;
        this.creditService = creditService;
        this.generationService = generationService;
        this.subscriptionRepository = subscriptionRepository;
        this.authenticatedUserService = authenticatedUserService;
    }

    // ─── Webhook (public, no JWT) ───

    @PostMapping("/webhooks/stripe")
    public ResponseEntity<String> handleWebhook(@RequestBody String payload,
                                                 @RequestHeader("Stripe-Signature") String sigHeader) {
        Event event;
        try {
            event = stripeService.verifyWebhookSignature(payload, sigHeader);
        } catch (SignatureVerificationException e) {
            log.warn("Stripe webhook signature verification failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body("Invalid signature");
        }

        log.info("Received Stripe event: {} (id={})", event.getType(), event.getId());

        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        StripeObject stripeObject;

        if (deserializer.getObject().isPresent()) {
            stripeObject = deserializer.getObject().get();
        } else {
            log.warn("Stripe API version mismatch for event {} — falling back to deserializeUnsafe()", event.getType());
            try {
                stripeObject = deserializer.deserializeUnsafe();
            } catch (Exception e) {
                log.error("Failed to deserialize Stripe event {}: {}", event.getType(), e.getMessage());
                return ResponseEntity.ok("OK");
            }
        }

        switch (event.getType()) {
            case "checkout.session.completed" -> handleCheckoutCompleted((Session) stripeObject);
            case "customer.subscription.updated" -> handleSubscriptionUpdated((Subscription) stripeObject);
            case "customer.subscription.deleted" -> handleSubscriptionDeleted((Subscription) stripeObject);
            case "invoice.paid" -> handleInvoicePaid((Invoice) stripeObject);
            default -> log.debug("Unhandled Stripe event type: {}", event.getType());
        }

        return ResponseEntity.ok("OK");
    }

    private void handleCheckoutCompleted(Session session) {
        Map<String, String> metadata = session.getMetadata();
        String type = metadata.getOrDefault("type", "");

        switch (type) {
            case "itinerary_generation" -> {
                String paymentIntentId = session.getPaymentIntent();
                generationService.handlePaymentSuccess(session.getId(), paymentIntentId);
                log.info("Processed itinerary generation payment: session={}", session.getId());
            }
            case "credit_pack" -> {
                Long userId = Long.parseLong(metadata.get("userId"));
                int quantity = Integer.parseInt(metadata.get("creditQuantity"));
                creditService.addCredits(userId, quantity);
                log.info("Added {} credits for user {}", quantity, userId);
            }
            case "subscription" -> {
                Long userId = Long.parseLong(metadata.get("userId"));
                String tier = metadata.getOrDefault("tier", "PRO");

                // Cancel any existing active subscriptions for this user (handles upgrades)
                subscriptionRepository.findAllByUserIdAndStatus(userId, SubscriptionStatus.ACTIVE)
                        .forEach(existing -> {
                            existing.setStatus(SubscriptionStatus.CANCELED);
                            subscriptionRepository.save(existing);
                            log.info("Canceled old subscription {} for user {} (upgrading)", existing.getStripeSubscriptionId(), userId);
                        });

                UserSubscription sub = new UserSubscription();
                sub.setUserId(userId);
                sub.setStripeCustomerId(session.getCustomer());
                sub.setStripeSubscriptionId(session.getSubscription());
                sub.setTier(SubscriptionTier.valueOf(tier));
                sub.setStatus(SubscriptionStatus.ACTIVE);
                sub.setGenerationsLimit(
                        tier.equals("UNLIMITED") ? Integer.MAX_VALUE : stripeService.getProGenerationsLimit());
                subscriptionRepository.save(sub);
                log.info("Created {} subscription for user {}", tier, userId);
            }
            default -> log.warn("Unknown checkout session type: {}", type);
        }
    }

    private void handleSubscriptionUpdated(Subscription sub) {
        subscriptionRepository.findByStripeSubscriptionId(sub.getId()).ifPresent(localSub -> {
            String status = sub.getStatus();
            switch (status) {
                case "active" -> localSub.setStatus(SubscriptionStatus.ACTIVE);
                case "past_due" -> localSub.setStatus(SubscriptionStatus.PAST_DUE);
                case "canceled" -> localSub.setStatus(SubscriptionStatus.CANCELED);
                default -> localSub.setStatus(SubscriptionStatus.EXPIRED);
            }
            if (sub.getCurrentPeriodStart() != null) {
                localSub.setCurrentPeriodStart(java.time.Instant.ofEpochSecond(sub.getCurrentPeriodStart()));
            }
            if (sub.getCurrentPeriodEnd() != null) {
                localSub.setCurrentPeriodEnd(java.time.Instant.ofEpochSecond(sub.getCurrentPeriodEnd()));
            }
            subscriptionRepository.save(localSub);
            log.info("Updated subscription {} status to {}", sub.getId(), status);
        });
    }

    private void handleSubscriptionDeleted(Subscription sub) {
        subscriptionRepository.findByStripeSubscriptionId(sub.getId()).ifPresent(localSub -> {
            localSub.setStatus(SubscriptionStatus.CANCELED);
            subscriptionRepository.save(localSub);
            log.info("Subscription {} canceled", sub.getId());
        });
    }

    private void handleInvoicePaid(Invoice invoice) {
        String subId = invoice.getSubscription();
        if (subId == null) return;

        subscriptionRepository.findByStripeSubscriptionId(subId).ifPresent(localSub -> {
            localSub.setGenerationsUsedThisMonth(0);
            subscriptionRepository.save(localSub);
            log.info("Reset generation count for subscription {}", subId);
        });
    }

    // ─── Authenticated endpoints ───

    @PostMapping("/stripe/credits/checkout")
    public ResponseEntity<?> createCreditsCheckout(Authentication auth, @RequestBody Map<String, Object> body) {
        Long userId = authenticatedUserService.getUserId(auth);
        int packSize = 5;
        if (body.containsKey("packSize")) {
            Object packSizeObj = body.get("packSize");
            if (packSizeObj instanceof Number) {
                packSize = ((Number) packSizeObj).intValue();
            } else if (packSizeObj instanceof String) {
                try {
                    packSize = Integer.parseInt((String) packSizeObj);
                } catch (NumberFormatException e) {
                    // fallback to 5
                }
            }
        }
        String cancelUrl = (String) body.get("cancelUrl");
        try {
            Session session = stripeService.createCreditPackCheckoutSession(userId, packSize, cancelUrl);
            return ResponseEntity.ok(Map.of("checkoutUrl", session.getUrl()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/stripe/subscribe")
    public ResponseEntity<?> createSubscription(Authentication auth, @RequestBody Map<String, String> body) {
        Long userId = authenticatedUserService.getUserId(auth);
        String tier = body.getOrDefault("tier", "PRO");
        String cancelUrl = body.get("cancelUrl");
        try {
            Session session = stripeService.createSubscriptionCheckoutSession(userId, tier, cancelUrl);
            return ResponseEntity.ok(Map.of("checkoutUrl", session.getUrl()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/stripe/my-subscription")
    public ResponseEntity<?> getMySubscription(Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);

        // Auto-cleanup: if multiple ACTIVE subs exist, keep only the newest
        var activeSubs = subscriptionRepository.findAllByUserIdAndStatus(userId, SubscriptionStatus.ACTIVE);
        if (activeSubs.size() > 1) {
            activeSubs.sort(Comparator.comparing(UserSubscription::getCreatedAt).reversed());
            for (int i = 1; i < activeSubs.size(); i++) {
                activeSubs.get(i).setStatus(SubscriptionStatus.CANCELED);
                subscriptionRepository.save(activeSubs.get(i));
                log.info("Auto-cleaned stale subscription {} for user {}", activeSubs.get(i).getStripeSubscriptionId(), userId);
            }
            UserSubscription latest = activeSubs.get(0);
            return ResponseEntity.ok(Map.of(
                    "tier", latest.getTier().name(),
                    "status", latest.getStatus().name(),
                    "generationsUsed", latest.getGenerationsUsedThisMonth(),
                    "generationsLimit", latest.getGenerationsLimit(),
                    "currentPeriodEnd", latest.getCurrentPeriodEnd() != null ? latest.getCurrentPeriodEnd().toString() : ""
            ));
        }

        return subscriptionRepository.findFirstByUserIdAndStatusOrderByCreatedAtDesc(userId, SubscriptionStatus.ACTIVE)
                .map(sub -> ResponseEntity.ok(Map.of(
                        "tier", sub.getTier().name(),
                        "status", sub.getStatus().name(),
                        "generationsUsed", sub.getGenerationsUsedThisMonth(),
                        "generationsLimit", sub.getGenerationsLimit(),
                        "currentPeriodEnd", sub.getCurrentPeriodEnd() != null ? sub.getCurrentPeriodEnd().toString() : ""
                )))
                .orElse(ResponseEntity.ok(Map.of("tier", "NONE")));
    }

    @GetMapping("/stripe/my-credits")
    public ResponseEntity<?> getMyCredits(Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(Map.of("balance", creditService.getBalance(userId)));
    }
}
