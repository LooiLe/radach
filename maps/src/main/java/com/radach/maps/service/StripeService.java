package com.radach.maps.service;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;

import jakarta.annotation.PostConstruct;

@Service
public class StripeService {

    private static final Logger log = LoggerFactory.getLogger(StripeService.class);

    @Value("${app.stripe.secret-key:}")
    private String secretKey;

    @Value("${app.stripe.webhook-secret:}")
    private String webhookSecret;

    @Value("${app.stripe.itinerary-price-cents:199}")
    private int itineraryPriceCents;

    @Value("${app.stripe.credit-pack-small-cents:799}")
    private int creditPackSmallCents;

    @Value("${app.stripe.credit-pack-small-qty:5}")
    private int creditPackSmallQty;

    @Value("${app.stripe.credit-pack-large-cents:1299}")
    private int creditPackLargeCents;

    @Value("${app.stripe.credit-pack-large-qty:10}")
    private int creditPackLargeQty;

    @Value("${app.stripe.pro-price-id:price_pro_placeholder}")
    private String proPriceId;

    @Value("${app.stripe.pro-generations-limit:5}")
    private int proGenerationsLimit;

    @Value("${app.stripe.unlimited-price-id:price_unlimited_placeholder}")
    private String unlimitedPriceId;

    @Value("${app.cors.allowed-origins:http://localhost:5173}")
    private String frontendUrl;

    @PostConstruct
    void init() {
        if (secretKey != null && !secretKey.isBlank()) {
            Stripe.apiKey = secretKey;
            log.info("Stripe API key configured");
        } else {
            log.warn("Stripe API key is not configured — payment features will be disabled");
        }
    }

    public boolean isConfigured() {
        return secretKey != null && !secretKey.isBlank() && !secretKey.equals("sk_test_your_test_key_here");
    }

    // --- Getters for pricing config (used by controllers/services) ---

    public int getItineraryPriceCents() { return itineraryPriceCents; }
    public int getCreditPackSmallCents() { return creditPackSmallCents; }
    public int getCreditPackSmallQty() { return creditPackSmallQty; }
    public int getCreditPackLargeCents() { return creditPackLargeCents; }
    public int getCreditPackLargeQty() { return creditPackLargeQty; }
    public String getProPriceId() { return proPriceId; }
    public int getProGenerationsLimit() { return proGenerationsLimit; }
    public String getUnlimitedPriceId() { return unlimitedPriceId; }

    private String resolveBaseUrl(String cancelUrl) {
        if (cancelUrl != null && !cancelUrl.isBlank() && (cancelUrl.startsWith("http://") || cancelUrl.startsWith("https://"))) {
            try {
                java.net.URI uri = new java.net.URI(cancelUrl);
                String scheme = uri.getScheme();
                String authority = uri.getAuthority();
                if (scheme != null && authority != null) {
                    return scheme + "://" + authority;
                }
            } catch (Exception e) {
                log.warn("Failed to parse base URL from cancelUrl {}: {}", cancelUrl, e.getMessage());
            }
        }
        String baseUrl = frontendUrl.split(",")[0].trim();
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }
        return baseUrl;
    }

    /**
     * Creates a one-time Stripe Checkout Session for itinerary generation.
     */
    public Session createOneTimeCheckoutSession(Long userId, Long generationId) throws StripeException {
        return createOneTimeCheckoutSession(userId, generationId, null);
    }

    public Session createOneTimeCheckoutSession(Long userId, Long generationId, String cancelUrl) throws StripeException {
        String baseUrl = resolveBaseUrl(cancelUrl);
        String finalCancelUrl = (cancelUrl != null && !cancelUrl.isBlank()) ? cancelUrl : (baseUrl + "/itineraries/plan?canceled=true");

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(baseUrl + "/payment/success?gen=" + generationId + "&session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(finalCancelUrl)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency("usd")
                                .setUnitAmount((long) itineraryPriceCents)
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName("AI Itinerary Generation")
                                        .setDescription("Personalized route generated based on your preferences")
                                        .build())
                                .build())
                        .build())
                .putMetadata("type", "itinerary_generation")
                .putMetadata("userId", userId.toString())
                .putMetadata("generationId", generationId.toString())
                .build();

        return Session.create(params);
    }

    /**
     * Creates a Checkout Session for purchasing a credit pack.
     */
    public Session createCreditPackCheckoutSession(Long userId, int packSize) throws StripeException {
        return createCreditPackCheckoutSession(userId, packSize, null);
    }

    public Session createCreditPackCheckoutSession(Long userId, int packSize, String cancelUrl) throws StripeException {
        String baseUrl = resolveBaseUrl(cancelUrl);
        String finalCancelUrl = (cancelUrl != null && !cancelUrl.isBlank()) ? cancelUrl : (baseUrl + "/itineraries/plan?canceled=true");
        int priceCents;
        int quantity;

        if (packSize <= 5) {
            priceCents = creditPackSmallCents;
            quantity = creditPackSmallQty;
        } else {
            priceCents = creditPackLargeCents;
            quantity = creditPackLargeQty;
        }

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(baseUrl + "/payment/success?type=credits&session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(finalCancelUrl)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency("usd")
                                .setUnitAmount((long) priceCents)
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName(quantity + " Itinerary Credits")
                                        .setDescription("Generate " + quantity + " personalized itineraries")
                                        .build())
                                .build())
                        .build())
                .putMetadata("type", "credit_pack")
                .putMetadata("userId", userId.toString())
                .putMetadata("creditQuantity", String.valueOf(quantity))
                .build();

        return Session.create(params);
    }

    /**
     * Creates a Checkout Session for starting a subscription.
     */
    public Session createSubscriptionCheckoutSession(Long userId, String tier) throws StripeException {
        return createSubscriptionCheckoutSession(userId, tier, null);
    }

    public Session createSubscriptionCheckoutSession(Long userId, String tier, String cancelUrl) throws StripeException {
        String baseUrl = resolveBaseUrl(cancelUrl);
        String finalCancelUrl = (cancelUrl != null && !cancelUrl.isBlank()) ? cancelUrl : (baseUrl + "/itineraries/plan?canceled=true");
        String priceId = tier.equalsIgnoreCase("UNLIMITED") ? unlimitedPriceId : proPriceId;

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setSuccessUrl(baseUrl + "/payment/success?type=subscription&session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(finalCancelUrl)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPrice(priceId)
                        .build())
                .putMetadata("type", "subscription")
                .putMetadata("userId", userId.toString())
                .putMetadata("tier", tier.toUpperCase())
                .build();

        return Session.create(params);
    }

    /**
     * Verifies a Stripe webhook signature and returns the Event.
     */
    public Event verifyWebhookSignature(String payload, String sigHeader) throws SignatureVerificationException {
        return Webhook.constructEvent(payload, sigHeader, webhookSecret);
    }
}
