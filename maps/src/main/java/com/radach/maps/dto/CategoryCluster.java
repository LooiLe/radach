package com.radach.maps.dto;

/**
 * Represents a cluster of spots grouped by category type.
 * Used at low zoom levels to show "Restaurant (120)" style markers.
 */
public record CategoryCluster(
        String type,
        long count,
        double latitude,
        double longitude,
        String iconPath
) {
}