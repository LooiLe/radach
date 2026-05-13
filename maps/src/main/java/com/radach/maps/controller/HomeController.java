package com.radach.maps.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {

    @GetMapping("/")
    public String index() {
        return "forward:/index.html";
    }

    @GetMapping("/login")
    public String login() {
        return "forward:/login.html";
    }

    @GetMapping("/register")
    public String register() {
        return "forward:/register.html";
    }

    @GetMapping("/spots")
    public String spots() {
        return "forward:/spots.html";
    }

    @GetMapping("/trending")
    public String trending() {
        return "forward:/trending.html";
    }

    @GetMapping("/search")
    public String search() {
        return "forward:/search.html";
    }

    @GetMapping("/spot")
    public String spot() {
        return "forward:/spot.html";
    }

}
