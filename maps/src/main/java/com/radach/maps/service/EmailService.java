package com.radach.maps.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_API_URL = "https://api.resend.com/emails";

    private final HttpClient httpClient;
    private final String apiKey;
    private final String fromEmail;

    public EmailService(
            @Value("${app.resend.api-key}") String apiKey,
            @Value("${app.resend.from-email}") String fromEmail
    ) {
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /**
     * Send an OTP verification email via Resend REST API.
     */
    public void sendOtpEmail(String toEmail, String otpCode) {
        String htmlBody = buildOtpHtml(otpCode);

        // Build JSON payload manually to avoid extra dependencies
        String json = """
                {
                  "from": "%s",
                  "to": ["%s"],
                  "subject": "Your Radach Maps verification code",
                  "html": %s
                }
                """.formatted(
                escapeJson(fromEmail),
                escapeJson(toEmail),
                toJsonString(htmlBody)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(RESEND_API_URL))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .timeout(Duration.ofSeconds(15))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("OTP email sent to {} via Resend", toEmail);
            } else {
                log.error("Resend API error (HTTP {}): {}", response.statusCode(), response.body());
                throw new RuntimeException("Failed to send verification email. Please try again.");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Resend API call interrupted for {}", toEmail, e);
            throw new RuntimeException("Failed to send verification email. Please try again.", e);
        } catch (RuntimeException e) {
            throw e; // re-throw our own RuntimeExceptions
        } catch (Exception e) {
            log.error("Failed to send OTP email to {} via Resend", toEmail, e);
            throw new RuntimeException("Failed to send verification email. Please try again.", e);
        }
    }

    private String buildOtpHtml(String otpCode) {
        return """
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
                  <h2 style="color: #1a1a2e; margin-bottom: 8px;">Verify your email</h2>
                  <p style="color: #555; font-size: 15px; line-height: 1.5;">
                    Use the code below to complete your Unlike Asia registration. It expires in 5 minutes.
                  </p>
                  <div style="background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #fff;">%s</span>
                  </div>
                  <p style="color: #999; font-size: 13px;">
                    If you didn't request this code, you can safely ignore this email.
                  </p>
                </div>
                """.formatted(otpCode);
    }

    /** Escape special characters for JSON string values. */
    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    /** Convert a string to a JSON-encoded string literal (with surrounding quotes). */
    private String toJsonString(String value) {
        return "\"" + value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t")
                + "\"";
    }
}
