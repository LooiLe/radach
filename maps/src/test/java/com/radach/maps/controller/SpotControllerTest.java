package com.radach.maps.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
public class SpotControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "test@example.com")
    public void testToggleSave() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/spots/1/save"))
                .andReturn();
        
        System.out.println("TEST RESULT STATUS: " + result.getResponse().getStatus());
        System.out.println("TEST RESULT BODY: " + result.getResponse().getContentAsString());
        if (result.getResolvedException() != null) {
            System.out.println("EXCEPTION CLASS: " + result.getResolvedException().getClass().getName());
            System.out.println("EXCEPTION MESSAGE: " + result.getResolvedException().getMessage());
            result.getResolvedException().printStackTrace();
        }
    }
}
