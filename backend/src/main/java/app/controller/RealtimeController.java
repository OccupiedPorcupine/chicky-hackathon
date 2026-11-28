package app.controller;

import app.assistant.RealtimeDtos.*;
import app.assistant.RealtimeService;
import app.user.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Existing SecurityConfig protects this entire API and enforces CSRF on mutations. */
@RestController
@RequestMapping("/api/assistant/realtime")
public class RealtimeController {
    private final RealtimeService realtime;
    public RealtimeController(RealtimeService realtime) { this.realtime = realtime; }
    @GetMapping("/status")
    public Status status() { return realtime.status(); }
    @PostMapping("/sessions")
    public ResponseEntity<Started> start(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody Start request) {
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).body(realtime.start(user.id(), request));
    }
    @PostMapping("/sessions/{id}/turns")
    public TurnResult turn(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id, @Valid @RequestBody Turn request) {
        return realtime.turn(user.id(), id, request);
    }
    @PostMapping("/sessions/{id}/tools")
    public ToolResult tool(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id, @Valid @RequestBody Tool request) {
        return realtime.execute(user.id(), id, request);
    }
    @PostMapping("/sessions/{id}/readback")
    public ReadbackResult readback(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id, @Valid @RequestBody Readback request) {
        return realtime.readback(user.id(), id, request);
    }
    @PostMapping("/sessions/{id}/confirm")
    public Confirmed confirm(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id, @Valid @RequestBody Confirm request) {
        return realtime.confirm(user.id(), id, request);
    }
    @PostMapping("/sessions/{id}/cancel")
    public Cancelled cancel(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id, @Valid @RequestBody Cancel request) {
        return realtime.cancel(user.id(), id, request);
    }
    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<Void> end(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id) {
        realtime.end(user.id(), id);
        return ResponseEntity.noContent().build();
    }
}
