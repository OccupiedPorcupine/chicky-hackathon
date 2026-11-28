package app.dto;

import app.user.AuthenticatedUser;
import io.swagger.v3.oas.annotations.media.Schema;

// Stores profile of authenticated users.
public record ProfileResponse(
        @Schema(description = "User ID", example = "1") Long userId,
        @Schema(description = "User email address", example = "user@example.com") String email,
        @Schema(description = "User display name", example = "Jane Doe") String name,
        @Schema(description = "URL of the user's profile picture", example = "https://example.com/profile.jpg") String pictureUrl,
        @Schema(description = "User role", example = "USER") String role,
        @Schema(description = "Whether the user has confirmed their email address through the emailed link") boolean emailVerified,
        @Schema(description = "Whether the user has seen the first-sign-in welcome") boolean welcomeSeen,
        @Schema(description = "Whether the account can sign in with Google") boolean googleLinked,
        @Schema(description = "Whether the account has a password; without one, Google can't be disconnected") boolean hasPassword
) {
    public static ProfileResponse from(AuthenticatedUser user, boolean emailVerified, boolean welcomeSeen,
                                       boolean googleLinked, boolean hasPassword) {
        return new ProfileResponse(user.id(), user.email(), user.name(), user.pictureUrl(), user.role(),
                emailVerified, welcomeSeen, googleLinked, hasPassword);
    }
}