package com.radach.maps.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.radach.maps.repository.ProcessedStripeEventRepository;
import com.radach.maps.service.StripeService;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.checkout.Session;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class StripeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProcessedStripeEventRepository processedStripeEventRepository;

    @MockBean
    private StripeService stripeService;

    @BeforeEach
    public void setUp() {
        processedStripeEventRepository.deleteAll();
    }

    @Test
    public void testWebhookIdempotency() throws Exception {
        // Arrange
        String eventId = "evt_test_12345";
        String eventType = "checkout.session.completed";
        
        Event mockEvent = mock(Event.class);
        when(mockEvent.getId()).thenReturn(eventId);
        when(mockEvent.getType()).thenReturn(eventType);
        
        Session mockSession = mock(Session.class);
        when(mockSession.getMetadata()).thenReturn(Map.of("type", "unknown"));
        
        EventDataObjectDeserializer mockDeserializer = mock(EventDataObjectDeserializer.class);
        when(mockEvent.getDataObjectDeserializer()).thenReturn(mockDeserializer);
        when(mockDeserializer.getObject()).thenReturn(Optional.of(mockSession));
        
        // Mock StripeService verification to return our mock event
        when(stripeService.verifyWebhookSignature(any(String.class), any(String.class)))
                .thenReturn(mockEvent);

        // Act - Call Webhook first time
        mockMvc.perform(post("/api/v1/webhooks/stripe")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Stripe-Signature", "t=123,v1=sig")
                .content("{}"))
                .andExpect(status().isOk());

        // Assert - Verify it was saved to the repository
        assertThat(processedStripeEventRepository.existsById(eventId)).isTrue();
        assertThat(processedStripeEventRepository.findById(eventId).get().getEventType()).isEqualTo(eventType);

        // Act - Call Webhook second time (duplicate event)
        mockMvc.perform(post("/api/v1/webhooks/stripe")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Stripe-Signature", "t=123,v1=sig")
                .content("{}"))
                .andExpect(status().isOk());

        // Verify that it still succeeded (200 OK) and was only saved once.
        assertThat(processedStripeEventRepository.count()).isEqualTo(1);
    }
}
