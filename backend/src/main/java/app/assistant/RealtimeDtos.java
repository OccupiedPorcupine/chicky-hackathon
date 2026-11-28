package app.assistant;

import app.dto.AssistantMessageResponse;
import app.dto.ConfirmProposalResponse;
import app.dto.PrepListResponse;
import jakarta.validation.constraints.*;
import tools.jackson.databind.JsonNode;

import java.time.Instant;

/** JSON DTOs shared with js/realtime.js; see docs/realtime-contract.md. */
public final class RealtimeDtos {
    private RealtimeDtos() {}
    public record Status(boolean available, String model, String voice) {}
    public record Start(@NotBlank @Size(max = 65536) String sdp) {}
    public record Started(String sessionId, String sdp, Instant expiresAt) {}
    public record Turn(@NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,128}") String turnId,
                       @Min(1) long sequence, @Size(max = 1000) String text) {}
    public record TurnResult(String turnId, long sequence, boolean finalized) {}
    public record Tool(@NotBlank @Size(max = 128) String callId,
                       @NotBlank @Size(max = 128) String turnId,
                       @Min(0) long expectedRevision, @NotBlank @Size(max = 64) String name,
                       @NotNull JsonNode arguments) {}
    public record ToolResult(JsonNode output, AssistantMessageResponse.Proposal proposal,
                             long revision, ConfirmProposalResponse saved, PrepListResponse prep) {}
    public record Readback(@Min(1) long revision, @NotBlank @Size(max = 128) String turnId) {}
    public record ReadbackResult(long revision, boolean ready) {}
    public record Confirm(@Min(1) long revision, @NotBlank @Size(max = 128) String turnId,
                          @NotBlank @Pattern(regexp = "voice|button") String mode) {}
    public record Confirmed(ConfirmProposalResponse saved, AssistantMessageResponse.Proposal proposal, long revision) {}
    public record Cancel(@Min(1) long revision) {}
    public record Cancelled(AssistantMessageResponse.Proposal proposal, long revision) {}
}
