package com.radach.maps.exception;

/**
 * Thrown when login credentials are invalid.
 * Mapped to HTTP 401 by GlobalExceptionHandler.
 */
public class BadCredentialsException extends RuntimeException {

    public BadCredentialsException(String message) {
        super(message);
    }
}
