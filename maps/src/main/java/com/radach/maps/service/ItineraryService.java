package com.radach.maps.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.ItineraryRequest;
import com.radach.maps.dto.ItineraryResponse;
import com.radach.maps.dto.StopRequest;
import com.radach.maps.dto.StopResponse;
import com.radach.maps.model.Itinerary;
import com.radach.maps.model.ItineraryStatus;
import com.radach.maps.model.ItineraryStop;
import com.radach.maps.model.Spot;
import com.radach.maps.repository.ItineraryRepository;
import com.radach.maps.repository.ItineraryGenerationRepository;
import com.radach.maps.repository.ItineraryStopRepository;
import com.radach.maps.repository.ReviewRepository;
import com.radach.maps.repository.SpotRepository;

@Service
public class ItineraryService {

    private final ItineraryRepository itineraryRepository;
    private final ItineraryGenerationRepository generationRepository;
    private final ItineraryStopRepository stopRepository;
    private final SpotRepository spotRepository;
    private final ReviewRepository reviewRepository;

    public ItineraryService(ItineraryRepository itineraryRepository,
                            ItineraryGenerationRepository generationRepository,
                            ItineraryStopRepository stopRepository,
                            SpotRepository spotRepository,
                            ReviewRepository reviewRepository) {
        this.itineraryRepository = itineraryRepository;
        this.generationRepository = generationRepository;
        this.stopRepository = stopRepository;
        this.spotRepository = spotRepository;
        this.reviewRepository = reviewRepository;
    }

    public List<ItineraryResponse> getMyItineraries(Long userId) {
        List<Itinerary> itineraries = itineraryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return itineraries.stream().map(it -> toResponse(it, false)).toList();
    }

    public ItineraryResponse getItinerary(Long userId, Long itineraryId) {
        Itinerary itinerary = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));
        return toResponse(itinerary, true);
    }

    public ItineraryResponse getSharedItinerary(String shareToken) {
        Itinerary itinerary = itineraryRepository.findByShareToken(shareToken)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));
        return toResponse(itinerary, true);
    }

    @Transactional
    public ItineraryResponse createItinerary(Long userId, ItineraryRequest request) {
        Itinerary itinerary = new Itinerary();
        itinerary.setUserId(userId);
        itinerary.setTitle(request.title());
        itinerary.setDescription(request.description());
        if (request.date() != null && !request.date().isBlank()) {
            itinerary.setDate(LocalDate.parse(request.date()));
        }
        if (request.endDate() != null && !request.endDate().isBlank()) {
            itinerary.setEndDate(LocalDate.parse(request.endDate()));
        }
        if (request.currency() != null && !request.currency().isBlank()) {
            itinerary.setCurrency(request.currency());
        }
        itinerary.setStatus(ItineraryStatus.DRAFT);
        itinerary = itineraryRepository.save(itinerary);

        if (request.stops() != null && !request.stops().isEmpty()) {
            saveStops(itinerary.getId(), request.stops());
        }

        return toResponse(itinerary, true);
    }

    @Transactional
    public ItineraryResponse updateItinerary(Long userId, Long itineraryId, ItineraryRequest request) {
        Itinerary itinerary = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));

        itinerary.setTitle(request.title());
        itinerary.setDescription(request.description());
        if (request.date() != null && !request.date().isBlank()) {
            itinerary.setDate(LocalDate.parse(request.date()));
        }
        if (request.endDate() != null && !request.endDate().isBlank()) {
            itinerary.setEndDate(LocalDate.parse(request.endDate()));
        }
        if (request.currency() != null && !request.currency().isBlank()) {
            itinerary.setCurrency(request.currency());
        }
        itinerary = itineraryRepository.save(itinerary);

        // Replace all stops
        stopRepository.deleteByItineraryId(itineraryId);
        stopRepository.flush();
        if (request.stops() != null && !request.stops().isEmpty()) {
            saveStops(itineraryId, request.stops());
        }

        return toResponse(itinerary, true);
    }

    @Transactional
    public void deleteItinerary(Long userId, Long itineraryId) {
        Itinerary itinerary = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));
        stopRepository.deleteByItineraryId(itineraryId);
        generationRepository.clearItineraryReference(itineraryId);
        itineraryRepository.delete(itinerary);
    }

    @Transactional
    public ItineraryResponse addStop(Long userId, Long itineraryId, StopRequest request) {
        Itinerary itinerary = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));

        // Verify spot exists
        spotRepository.findById(request.spotId())
                .orElseThrow(() -> new IllegalArgumentException("Spot not found"));

        ItineraryStop stop = new ItineraryStop();
        stop.setItineraryId(itineraryId);
        stop.setSpotId(request.spotId());
        stop.setStopOrder(request.stopOrder());
        if (request.startTime() != null) stop.setStartTime(LocalTime.parse(request.startTime()));
        if (request.endTime() != null) stop.setEndTime(LocalTime.parse(request.endTime()));
        stop.setDurationMinutes(request.durationMinutes());
        stop.setNotes(request.notes());
        if (request.dayNumber() != null) stop.setDayNumber(request.dayNumber());
        stop.setEstimatedCostCents(request.estimatedCostCents());
        stopRepository.save(stop);

        return toResponse(itinerary, true);
    }

    @Transactional
    public ItineraryResponse addSpotAfterStop(Long userId, Long itineraryId, Long afterStopId, Long spotId) {
        Itinerary itinerary = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));

        if (spotId == null) {
            throw new IllegalArgumentException("Spot is required");
        }
        spotRepository.findById(spotId)
                .orElseThrow(() -> new IllegalArgumentException("Spot not found"));

        List<ItineraryStop> stops = stopRepository.findByItineraryIdOrderByStopOrderAsc(itineraryId);
        ItineraryStop anchor = null;
        if (afterStopId != null) {
            anchor = stops.stream()
                    .filter(stop -> stop.getId().equals(afterStopId))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Stop does not belong to this itinerary"));
        }

        int insertOrder = anchor != null ? anchor.getStopOrder() + 1 : stops.size() + 1;
        int dayNumber = anchor != null ? anchor.getDayNumber() : 1;
        int durationMinutes = 60;
        LocalTime newStartTime = anchor != null && anchor.getEndTime() != null ? anchor.getEndTime() : null;

        for (ItineraryStop stop : stops) {
            if (stop.getStopOrder() >= insertOrder) {
                stop.setStopOrder(-stop.getStopOrder());
            }
        }
        stopRepository.saveAll(stops);
        stopRepository.flush();

        for (ItineraryStop stop : stops) {
            if (stop.getStopOrder() < 0) {
                stop.setStopOrder(Math.abs(stop.getStopOrder()) + 1);
                shiftStopTime(stop, dayNumber, durationMinutes);
            }
        }
        stopRepository.saveAll(stops);

        ItineraryStop newStop = new ItineraryStop();
        newStop.setItineraryId(itineraryId);
        newStop.setSpotId(spotId);
        newStop.setStopOrder(insertOrder);
        newStop.setDayNumber(dayNumber);
        newStop.setStartTime(newStartTime);
        newStop.setEndTime(newStartTime != null ? newStartTime.plusMinutes(durationMinutes) : null);
        newStop.setDurationMinutes(durationMinutes);
        newStop.setNotes("Added from AR");
        stopRepository.save(newStop);

        return toResponse(itinerary, true);
    }

    @Transactional
    public ItineraryResponse replaceStopSpot(Long userId, Long itineraryId, Long stopId, Long spotId) {
        Itinerary itinerary = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));

        if (spotId == null) {
            throw new IllegalArgumentException("Spot is required");
        }
        spotRepository.findById(spotId)
                .orElseThrow(() -> new IllegalArgumentException("Spot not found"));

        ItineraryStop stop = stopRepository.findById(stopId)
                .orElseThrow(() -> new IllegalArgumentException("Stop not found"));

        if (!stop.getItineraryId().equals(itineraryId)) {
            throw new IllegalArgumentException("Stop does not belong to this itinerary");
        }

        stop.setSpotId(spotId);
        stop.setNotes(mergeArNote(stop.getNotes(), "Replaced from AR"));
        stopRepository.save(stop);

        return toResponse(itinerary, true);
    }

    @Transactional
    public ItineraryResponse optimizeRemainingStops(Long userId, Long itineraryId, Long anchorStopId) {
        Itinerary itinerary = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));

        List<ItineraryStop> stops = stopRepository.findByItineraryIdOrderByStopOrderAsc(itineraryId);
        ItineraryStop anchor = stops.stream()
                .filter(stop -> stop.getId().equals(anchorStopId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Stop does not belong to this itinerary"));

        List<ItineraryStop> remainingSameDay = stops.stream()
                .filter(stop -> stop.getDayNumber() == anchor.getDayNumber())
                .filter(stop -> stop.getStopOrder() > anchor.getStopOrder())
                .toList();

        if (remainingSameDay.size() < 2) {
            return toResponse(itinerary, true);
        }

        List<Long> spotIds = new ArrayList<>();
        spotIds.add(anchor.getSpotId());
        remainingSameDay.forEach(stop -> spotIds.add(stop.getSpotId()));
        Map<Long, Spot> spotMap = spotRepository.findAllById(spotIds).stream()
                .collect(Collectors.toMap(Spot::getId, spot -> spot));

        List<ItineraryStop> optimizedStops = optimizeStopOrderByDistance(
                remainingSameDay,
                spotMap.get(anchor.getSpotId()),
                spotMap
        );
        List<Integer> originalStopOrders = remainingSameDay.stream()
                .map(ItineraryStop::getStopOrder)
                .toList();

        for (ItineraryStop stop : remainingSameDay) {
            stop.setStopOrder(-100_000 - stop.getStopOrder());
        }
        stopRepository.saveAll(remainingSameDay);
        stopRepository.flush();

        for (int i = 0; i < remainingSameDay.size(); i++) {
            ItineraryStop optimizedStop = optimizedStops.get(i);
            optimizedStop.setStopOrder(originalStopOrders.get(i));
        }

        recalculateRemainingTimes(anchor, optimizedStops, spotMap);
        stopRepository.saveAll(optimizedStops);

        return toResponse(itinerary, true);
    }

    private void shiftStopTime(ItineraryStop stop, int dayNumber, int durationMinutes) {
        if (stop.getDayNumber() != dayNumber) {
            return;
        }
        if (stop.getStartTime() != null) {
            stop.setStartTime(stop.getStartTime().plusMinutes(durationMinutes));
        }
        if (stop.getEndTime() != null) {
            stop.setEndTime(stop.getEndTime().plusMinutes(durationMinutes));
        }
    }

    private List<ItineraryStop> optimizeStopOrderByDistance(List<ItineraryStop> stops, Spot startSpot, Map<Long, Spot> spotMap) {
        if (startSpot == null || startSpot.getLatitude() == null || startSpot.getLongitude() == null) {
            return new ArrayList<>(stops);
        }

        List<ItineraryStop> ordered = new ArrayList<>();
        List<ItineraryStop> remaining = new ArrayList<>(stops);
        double currentLat = startSpot.getLatitude();
        double currentLng = startSpot.getLongitude();

        while (!remaining.isEmpty()) {
            ItineraryStop nearest = null;
            double minDistance = Double.MAX_VALUE;

            for (ItineraryStop stop : remaining) {
                Spot spot = spotMap.get(stop.getSpotId());
                if (spot == null || spot.getLatitude() == null || spot.getLongitude() == null) {
                    continue;
                }
                double distance = haversineDistance(currentLat, currentLng, spot.getLatitude(), spot.getLongitude());
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = stop;
                }
            }

            if (nearest == null) {
                ordered.addAll(remaining);
                break;
            }

            ordered.add(nearest);
            Spot nearestSpot = spotMap.get(nearest.getSpotId());
            currentLat = nearestSpot.getLatitude();
            currentLng = nearestSpot.getLongitude();
            remaining.remove(nearest);
        }

        return ordered;
    }

    private void recalculateRemainingTimes(ItineraryStop anchor, List<ItineraryStop> orderedStops, Map<Long, Spot> spotMap) {
        LocalTime cursor = anchor.getEndTime();
        if (cursor == null && anchor.getStartTime() != null) {
            cursor = anchor.getStartTime().plusMinutes(resolveDurationMinutes(anchor, spotMap.get(anchor.getSpotId())));
        }
        if (cursor == null) {
            cursor = LocalTime.of(9, 0);
        }

        Spot previousSpot = spotMap.get(anchor.getSpotId());
        for (ItineraryStop stop : orderedStops) {
            Spot currentSpot = spotMap.get(stop.getSpotId());
            int travelMinutes = estimateTravelTimeMinutes(previousSpot, currentSpot);
            LocalTime start = cursor.plusMinutes(travelMinutes);
            int duration = resolveDurationMinutes(stop, currentSpot);

            stop.setStartTime(start);
            stop.setDurationMinutes(duration);
            stop.setEndTime(start.plusMinutes(duration));

            cursor = stop.getEndTime();
            previousSpot = currentSpot;
        }
    }

    private int resolveDurationMinutes(ItineraryStop stop, Spot spot) {
        if (stop.getDurationMinutes() != null && stop.getDurationMinutes() > 0) {
            return stop.getDurationMinutes();
        }
        if (spot == null || spot.getType() == null) {
            return 60;
        }
        String type = spot.getType().trim().toLowerCase();
        if (type.contains("restaurant") || type.contains("bar") || type.contains("cafe")) {
            return 75;
        }
        if (type.contains("museum") || type.contains("attraction") || type.contains("gallery")) {
            return 90;
        }
        if (type.contains("market") || type.contains("shopping")) {
            return 60;
        }
        if (type.contains("viewpoint") || type.contains("beach") || type.contains("park")) {
            return 45;
        }
        return 60;
    }

    private int estimateTravelTimeMinutes(Spot from, Spot to) {
        if (from == null || to == null
                || from.getLatitude() == null || from.getLongitude() == null
                || to.getLatitude() == null || to.getLongitude() == null) {
            return 15;
        }
        double distance = haversineDistance(from.getLatitude(), from.getLongitude(), to.getLatitude(), to.getLongitude());
        if (distance < 1.0) {
            return (int) Math.max(5, Math.round((distance * 12.0) + 2.0));
        }
        return (int) Math.max(7, Math.round((distance * 2.0) + 3.0));
    }

    private double haversineDistance(double lat1, double lng1, double lat2, double lng2) {
        double earthRadiusKm = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return earthRadiusKm * 2 * Math.asin(Math.sqrt(a));
    }

    @Transactional
    public ItineraryResponse removeStop(Long userId, Long itineraryId, Long stopId) {
        Itinerary itinerary = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));

        ItineraryStop stop = stopRepository.findById(stopId)
                .orElseThrow(() -> new IllegalArgumentException("Stop not found"));

        if (!stop.getItineraryId().equals(itineraryId)) {
            throw new IllegalArgumentException("Stop does not belong to this itinerary");
        }

        stopRepository.delete(stop);

        // Re-order remaining stops
        List<ItineraryStop> remaining = stopRepository.findByItineraryIdOrderByStopOrderAsc(itineraryId);
        for (int i = 0; i < remaining.size(); i++) {
            remaining.get(i).setStopOrder(i + 1);
        }
        stopRepository.saveAll(remaining);

        return toResponse(itinerary, true);
    }

    @Transactional
    public ItineraryResponse reorderStops(Long userId, Long itineraryId, List<Long> stopIds) {
        Itinerary itinerary = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));

        List<ItineraryStop> stops = stopRepository.findByItineraryIdOrderByStopOrderAsc(itineraryId);
        Map<Long, ItineraryStop> stopMap = stops.stream()
                .collect(Collectors.toMap(ItineraryStop::getId, s -> s));

        for (int i = 0; i < stopIds.size(); i++) {
            ItineraryStop stop = stopMap.get(stopIds.get(i));
            if (stop == null) throw new IllegalArgumentException("Stop ID " + stopIds.get(i) + " not found");
            stop.setStopOrder(i + 1);
        }
        stopRepository.saveAll(stops);

        return toResponse(itinerary, true);
    }

    @Transactional
    public ItineraryResponse cloneItinerary(Long userId, Long itineraryId) {
        Itinerary source = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));

        Itinerary clone = new Itinerary();
        clone.setUserId(userId);
        clone.setTitle("Copy of " + source.getTitle());
        clone.setDescription(source.getDescription());
        clone.setDate(LocalDate.now());
        clone.setEndDate(source.getEndDate());
        clone.setCurrency(source.getCurrency());
        clone.setStatus(ItineraryStatus.DRAFT);
        clone.setSource(source.getSource());
        clone.setGenerationPreferences(source.getGenerationPreferences());
        clone = itineraryRepository.save(clone);

        // Copy all stops
        List<ItineraryStop> sourceStops = stopRepository.findByItineraryIdOrderByStopOrderAsc(itineraryId);
        List<ItineraryStop> clonedStops = new ArrayList<>();
        for (ItineraryStop srcStop : sourceStops) {
            ItineraryStop newStop = new ItineraryStop();
            newStop.setItineraryId(clone.getId());
            newStop.setSpotId(srcStop.getSpotId());
            newStop.setStopOrder(srcStop.getStopOrder());
            newStop.setStartTime(srcStop.getStartTime());
            newStop.setEndTime(srcStop.getEndTime());
            newStop.setDurationMinutes(srcStop.getDurationMinutes());
            newStop.setNotes(srcStop.getNotes());
            newStop.setDayNumber(srcStop.getDayNumber());
            newStop.setEstimatedCostCents(srcStop.getEstimatedCostCents());
            clonedStops.add(newStop);
        }
        stopRepository.saveAll(clonedStops);

        return toResponse(clone, true);
    }

    // --- Helper methods ---

    private void saveStops(Long itineraryId, List<StopRequest> stopRequests) {
        List<ItineraryStop> stops = new ArrayList<>();
        for (StopRequest sr : stopRequests) {
            ItineraryStop stop = new ItineraryStop();
            stop.setItineraryId(itineraryId);
            stop.setSpotId(sr.spotId());
            stop.setStopOrder(sr.stopOrder());
            if (sr.startTime() != null) stop.setStartTime(LocalTime.parse(sr.startTime()));
            if (sr.endTime() != null) stop.setEndTime(LocalTime.parse(sr.endTime()));
            stop.setDurationMinutes(sr.durationMinutes());
            stop.setNotes(sr.notes());
            if (sr.dayNumber() != null) stop.setDayNumber(sr.dayNumber());
            stop.setEstimatedCostCents(sr.estimatedCostCents());
            stops.add(stop);
        }
        stopRepository.saveAll(stops);
    }

    private String mergeArNote(String existing, String arNote) {
        if (existing == null || existing.isBlank()) {
            return arNote;
        }
        if (existing.contains(arNote)) {
            return existing;
        }
        return existing + "\n" + arNote;
    }

    ItineraryResponse toResponse(Itinerary itinerary, boolean includeStops) {
        List<StopResponse> stopResponses = List.of();
        int stopCount = 0;

        if (includeStops) {
            List<ItineraryStop> stops = stopRepository.findByItineraryIdOrderByStopOrderAsc(itinerary.getId());
            stopCount = stops.size();

            if (!stops.isEmpty()) {
                // Batch-fetch spots
                List<Long> spotIds = stops.stream().map(ItineraryStop::getSpotId).toList();
                Map<Long, Spot> spotMap = spotRepository.findAllById(spotIds).stream()
                        .collect(Collectors.toMap(Spot::getId, s -> s));

                // Batch-fetch average ratings
                Map<Long, Double> ratingMap = reviewRepository.findAverageRatingsBySpotIds(spotIds).stream()
                        .collect(Collectors.toMap(
                                row -> (Long) row[0],
                                row -> (Double) row[1]
                        ));

                stopResponses = stops.stream().map(stop -> {
                    Spot spot = spotMap.get(stop.getSpotId());
                    Double avgRating = ratingMap.getOrDefault(stop.getSpotId(), 0.0);
                    return new StopResponse(
                            stop.getId(),
                            stop.getStopOrder(),
                            stop.getSpotId(),
                            spot != null ? spot.getName() : "Unknown",
                            spot != null ? spot.getType() : null,
                            spot != null ? spot.getAddress() : null,
                            spot != null ? spot.getLatitude() : null,
                            spot != null ? spot.getLongitude() : null,
                            spot != null ? spot.getPhotos() : List.of(),
                            avgRating,
                            stop.getStartTime() != null ? stop.getStartTime().toString() : null,
                            stop.getEndTime() != null ? stop.getEndTime().toString() : null,
                            stop.getDurationMinutes(),
                            stop.getNotes(),
                            stop.getDayNumber(),
                            stop.getEstimatedCostCents()
                    );
                }).toList();
            }
        } else {
            stopCount = stopRepository.findByItineraryIdOrderByStopOrderAsc(itinerary.getId()).size();
        }

        return new ItineraryResponse(
                itinerary.getId(),
                itinerary.getUserId(),
                itinerary.getTitle(),
                itinerary.getDescription(),
                itinerary.getDate(),
                itinerary.getEndDate(),
                itinerary.getCurrency(),
                itinerary.getStatus().name(),
                itinerary.getSource().name(),
                stopResponses,
                stopCount,
                itinerary.getShareToken(),
                itinerary.getCreatedAt(),
                itinerary.getUpdatedAt()
        );
    }
}
