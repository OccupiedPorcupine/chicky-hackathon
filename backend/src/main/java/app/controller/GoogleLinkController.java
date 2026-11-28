package app.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;

import app.dto.GoogleLoginRequest;
import app.service.AppUserService;
import app.service.GoogleAuthService;
import app.user.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

// Adds (POST) or removes (DELETE) Google sign-in for the account that is already signed in, typically one made with email and
// password. Signing in with Google alone can't do this for a confirmed account (ACCOUNT_LINKING_REQUIRED),
// since a matching email is not proof that both logins belong to one person; being signed in is.
@Tag(name = "Profile", description = "Authenticated user profile operations")
@RestController
@RequestMapping("/api/account/google-link")
public class GoogleLinkController {

    private final GoogleAuthService googleAuthService;
    private final AppUserService appUserService;

    public GoogleLinkController(GoogleAuthService googleAuthService, AppUserService appUserService) {
        this.googleAuthService = googleAuthService;
        this.appUserService = appUserService;
    }

    public record GoogleLinkResponse(boolean googleLinked) {}

    @Operation(summary = "Link Google sign-in",
            description = "Links the Google account in the ID token to the signed-in account, so it can sign in with Google from then on.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Linked (or already linked to this Google account)"),
            @ApiResponse(responseCode = "401", description = "Not signed in, or the Google credential is invalid", content = @Content),
            @ApiResponse(responseCode = "409", description = "The Google account's email differs, it is linked to another account, "
                    + "or this account is linked to a different Google account", content = @Content),
            @ApiResponse(responseCode = "503", description = "Google sign-in is not configured on this server", content = @Content)
    })
    @PostMapping
    public ResponseEntity<GoogleLinkResponse> link(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody GoogleLoginRequest request
    ) {
        GoogleIdToken.Payload payload = googleAuthService.verifyToken(request.credential());
        appUserService.linkGoogle(principal.id(), payload);
        return ResponseEntity.ok(new GoogleLinkResponse(true));
    }

    @Operation(summary = "Disconnect Google sign-in",
            description = "Removes Google sign-in from the signed-in account, which then signs in with its email and password only.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Disconnected (or was not linked)"),
            @ApiResponse(responseCode = "401", description = "Not signed in", content = @Content),
            @ApiResponse(responseCode = "409", description = "The account has no password, so it could no longer sign in", content = @Content)
    })
    @DeleteMapping
    public ResponseEntity<GoogleLinkResponse> unlink(@AuthenticationPrincipal AuthenticatedUser principal) {
        appUserService.unlinkGoogle(principal.id());
        return ResponseEntity.ok(new GoogleLinkResponse(false));
    }
}
