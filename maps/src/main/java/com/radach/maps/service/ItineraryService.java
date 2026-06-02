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

    @Transactional
    public ItineraryResponse createItinerary(Long userId, ItineraryRequest request) {
        Itinerary itinerary = new Itinerary();
        itinerary.setUserId(userId);
        itinerary.setTitle(request.title());
        itinerary.setDescription(request.description());
        if (request.date() != null && !request.date().isBlank()) {
            itinerary.setDate(LocalDate.parse(request.date()));
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
        stopRepository.save(stop);

        return toResponse(itinerary, true);
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
            stops.add(stop);
        }
        stopRepository.saveAll(stops);
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
                            stop.getNotes()
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
                itinerary.getStatus().name(),
                itinerary.getSource().name(),
                stopResponses,
                stopCount,
                itinerary.getCreatedAt(),
                itinerary.getUpdatedAt()
        );
    }
}
