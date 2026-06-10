package com.radach.maps.dto;

import java.util.List;

public record SpotMapResponse(
        String mode,
        long total,
        boolean limited,
        List<MapSpotResponse> spots,
        List<SpotClusterResponse> clusters,
        List<CategoryCluster> categoryClusters
) {
    public static SpotMapResponse spots(long total, boolean limited, List<MapSpotResponse> spots) {
        return new SpotMapResponse("spots", total, limited, spots, List.of(), List.of());
    }

    public static SpotMapResponse clusters(long total, List<MapSpotResponse> spots, List<SpotClusterResponse> clusters) {
        return new SpotMapResponse("clusters", total, false, spots, clusters, List.of());
    }

    public static SpotMapResponse categoryClusters(long total, List<CategoryCluster> categoryClusters) {
        return new SpotMapResponse("categoryClusters", total, false, List.of(), List.of(), categoryClusters);
    }
}
