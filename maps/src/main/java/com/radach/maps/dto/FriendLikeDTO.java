package com.radach.maps.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record FriendLikeDTO(
    Long userId,
    String name,
    @JsonProperty("profilePicture") String profilePictureUrl
) {}