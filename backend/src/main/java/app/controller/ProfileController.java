package app.controller;

import java.time.Instant;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

import app.dto.ProfileResponse;
import app.user.AppUser;
import app.user.AppUserRepository;
import app.user.AuthenticatedUser;

@Tag(name = "Profile", description = "Authenticated user profile operations")
@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final AppUserRepository appUserRepository;

    public ProfileController(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    @Operation(summary = "Get user profile", description = "Returns the profile of the currently authenticated user.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Profile retrieved successfully"),
            @ApiResponse(responseCode = "401", description = "User is not authenticated", content = @Content)
    })
    @GetMapping
    public ResponseEntity<ProfileResponse> profile(@AuthenticationPrincipal AuthenticatedUser user) {
        // Read from the database: the session's copy doesn't change when the email is confirmed.
        AppUser account = appUserRepository.findById(user.id()).orElse(null);
        boolean verified = account != null && account.isEmailVerified();
        // A missing row counts as seen, so nobody is held on the welcome.
        boolean welcomeSeen = account == null || account.hasSeenWelcome();
        boolean googleLinked = account != null && account.getGoogleId() != null;
        return ResponseEntity.ok(ProfileResponse.from(user, verified, welcomeSeen, googleLinked));
    }

    @Operation(summary = "Mark the welcome as seen",
            description = "Called when the first-sign-in welcome is shown, so every later sign-in, on any device, goes straight to the Dashboard.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Recorded (or already recorded)"),
            @ApiResponse(responseCode = "401", description = "User is not authenticated", content = @Content)
    })
    @PostMapping("/welcome-seen")
    @Transactional
    public ResponseEntity<Void> welcomeSeen(@AuthenticationPrincipal AuthenticatedUser user) {
        appUserRepository.findById(user.id()).ifPresent(account -> account.markWelcomeSeen(Instant.now()));
        return ResponseEntity.noContent().build();
    }
}
