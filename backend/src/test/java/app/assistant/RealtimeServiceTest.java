package app.assistant;

import app.dish.Dish;
import app.dto.ProposalEntryInput;
import app.sale.DailySaleRepository;
import app.service.DishService;
import app.service.PrepListService;
import app.service.PublicHolidaySyncService;
import app.user.AppUser;
import app.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static app.assistant.RealtimeDtos.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** Real proposal persistence/validation/confirmation with a fake SDP provider. No paid calls. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RealtimeServiceTest {
    @LocalServerPort int port;
    @MockitoBean PublicHolidaySyncService holidays;
    @MockitoBean RealtimeSessionProvider provider;
    @Autowired RealtimeService realtime;
    @Autowired RealtimeProposalStore proposals;
    @Autowired AssistantService assistant;
    @Autowired AssistantTools tools;
    @Autowired PrepListService prep;
    @Autowired AssistantRateLimiter rate;
    @Autowired AssistantUsageService usage;
    @Autowired AppUserRepository users;
    @Autowired DishService dishes;
    @Autowired DailySaleRepository sales;
    @Autowired JsonMapper mapper;
    @Autowired Clock clock;
    Long owner, other;
    Dish chicken, pork;

    @BeforeEach void setup() {
        when(provider.available()).thenReturn(true);
        when(provider.model()).thenReturn("fake-realtime");
        when(provider.voice()).thenReturn("cedar");
        when(provider.answer(anyString(), any())).thenReturn("v=0\r\nfake-answer");
        owner = users.save(AppUser.localUser(UUID.randomUUID()+"@realtime.test", "{noop}x", "Demo")).getId();
        other = users.save(AppUser.localUser(UUID.randomUUID()+"@realtime.test", "{noop}x", "Other")).getId();
        chicken = dishes.createDish("Roasted chicken rice", owner);
        pork = dishes.createDish("Char siew rice", owner);
    }

    String start() { return realtime.start(owner, new Start("v=0\r\nfake-offer")).sessionId(); }
    void turn(String id, int n, String text) { realtime.turn(owner, id, new Turn("turn-"+n, n, text)); }
    Tool propose(int turn, long revision) {
        var entries = List.of(new ProposalEntryInput(chicken.getId(), null, "roast chicken", LocalDate.now(clock), 40, null, null),
                new ProposalEntryInput(pork.getId(), null, "char siew", LocalDate.now(clock), 30, null, 5));
        var args = mapper.createObjectNode(); args.set("entries", mapper.valueToTree(entries));
        return new Tool("propose-"+turn, "turn-"+turn, revision, "propose_sales", args);
    }
    void code(String expected, Runnable action) {
        assertEquals(expected, assertThrows(AssistantException.class, action::run).getCode());
    }

    @Test void correctionAndExplicitLaterAffirmationSaveOnlyTheLatestProposalOnce() {
        String id = start(); turn(id, 1, "roast chicken 40, char siew 30 with 5 left over");
        var first = realtime.execute(owner, id, propose(1, 0));
        assertTrue(sales.findByDishIdOrderBySaleDateAsc(chicken.getId()).isEmpty());
        turn(id, 2, "Wait, roast chicken forty-two");
        var changes = mapper.createObjectNode();
        changes.putArray("changes").addObject().put("dishId", chicken.getId()).put("quantity", 42);
        var corrected = realtime.execute(owner, id, new Tool("fix", "turn-2", 1, "revise_sales", changes));
        assertEquals(42, corrected.proposal().entries().getFirst().quantity());
        assertEquals(5, corrected.proposal().entries().getLast().leftoverQuantity());
        code("PROPOSAL_CLOSED", () -> assistant.confirmProposal(owner, first.proposal().id(), null));
        code("CONFIRMATION_REQUIRED", () -> realtime.confirm(owner, id, new Confirm(2,"turn-2","voice")));
        realtime.readback(owner, id, new Readback(2,"turn-2"));
        turn(id, 3, "don't save");
        code("CONFIRMATION_REQUIRED", () -> realtime.confirm(owner,id,new Confirm(2,"turn-3","voice")));
        assertTrue(sales.findByDishIdOrderBySaleDateAsc(chicken.getId()).isEmpty());
        turn(id, 4, "对，save。");
        var confirmed = realtime.confirm(owner,id,new Confirm(2,"turn-4","voice"));
        assertNotNull(confirmed.saved());
        assertEquals(42, sales.findByDishIdOrderBySaleDateAsc(chicken.getId()).getFirst().getQuantitySold());
        assertEquals(30, sales.findByDishIdOrderBySaleDateAsc(pork.getId()).getFirst().getQuantitySold());
        realtime.confirm(owner,id,new Confirm(2,"turn-4","voice"));
        assertEquals(1, sales.findByDishIdOrderBySaleDateAsc(chicken.getId()).size());
        realtime.end(owner,id);
    }

    @Test void staleTurnsRevisionsAndConflictingDuplicateCallsAreRejected() {
        String id=start(); turn(id,1,"roast chicken forty");
        var first = realtime.execute(owner,id,propose(1,0));
        assertEquals(first.proposal().id(),realtime.execute(owner,id,propose(1,0)).proposal().id());
        code("CALL_ID_REUSED", () -> realtime.execute(owner,id,new Tool("propose-1","turn-1",0,"get_prep_list",mapper.createObjectNode())));
        turn(id,2,null);
        code("STALE_TURN", () -> realtime.execute(owner,id,propose(1,1)));
        code("TURN_NOT_FINAL", () -> realtime.execute(owner,id,new Tool("not-final","turn-2",1,"get_prep_list",mapper.createObjectNode())));
        turn(id,2,"forty-two");
        code("TURN_FINALIZED", () -> turn(id,2,"forty-three"));
        code("STALE_REVISION", () -> realtime.confirm(owner,id,new Confirm(0,"turn-2","button")));
        assertTrue(sales.findByDishIdOrderBySaleDateAsc(chicken.getId()).isEmpty());
        realtime.end(owner,id);
    }

    @Test void ownerIsolationAndToolAllowlistHoldWithoutModelCooperation() {
        String id=start(); turn(id,1,"sales");
        code("REALTIME_SESSION_NOT_FOUND", () -> realtime.turn(other,id,new Turn("foreign",1,"save")));
        code("UNKNOWN_TOOL", () -> realtime.execute(owner,id,new Tool("save","turn-1",0,"confirm_sales",mapper.createObjectNode())));
        Dish foreign=dishes.createDish("Other dish",other);
        var args=mapper.createObjectNode();
        args.set("entries",mapper.valueToTree(List.of(new ProposalEntryInput(foreign.getId(),null,"Other dish",LocalDate.now(clock),42))));
        code("INVALID_PROPOSAL", () -> realtime.execute(owner,id,new Tool("foreign","turn-1",0,"propose_sales",args)));
        realtime.end(owner,id);
    }

    @Test void cancellationAndSessionEndInvalidatePersistentPendingProposals() {
        String id=start(); turn(id,1,"sales");
        var first=realtime.execute(owner,id,propose(1,0));
        assertEquals(2,realtime.cancel(owner,id,new Cancel(1)).revision());
        code("PROPOSAL_CLOSED", () -> assistant.confirmProposal(owner,first.proposal().id(),null));
        turn(id,2,"sales again");
        var second=realtime.execute(owner,id,propose(2,2));
        realtime.end(owner,id);
        code("PROPOSAL_CLOSED", () -> assistant.confirmProposal(owner,second.proposal().id(),null));
        code("REALTIME_SESSION_NOT_FOUND", () -> realtime.turn(owner,id,new Turn("ended",3,"save")));
    }

    @Test void disabledProviderFailsClosedAndConfigurationHasNoSaveTool() {
        var config=realtime.sessionConfiguration(owner);
        assertFalse(config.path("audio").path("input").path("turn_detection").path("create_response").asBoolean());
        assertEquals(3,config.path("tools").size());
        assertTrue(config.path("instructions").asText().contains("Roasted chicken rice"));
        assertFalse(config.path("instructions").asText().contains("Other dish"));
        when(provider.available()).thenReturn(false);
        code("ASSISTANT_UNAVAILABLE", () -> start());
    }

    @Test void externallyConfirmedProposalDoesNotPreventSessionCleanup() {
        String id=start(); turn(id,1,"sales");
        var result=realtime.execute(owner,id,propose(1,0));
        assistant.confirmProposal(owner,result.proposal().id(),null);
        realtime.end(owner,id);
        code("REALTIME_SESSION_NOT_FOUND", () -> realtime.turn(owner,id,new Turn("ended",2,"save")));
    }

    @Test void sessionBootstrapRequiresAuthenticationAndCsrf() throws Exception {
        var client=java.net.http.HttpClient.newBuilder().cookieHandler(new java.net.CookieManager()).build();
        String base="http://localhost:"+port;
        var status=client.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create(base+"/api/assistant/realtime/status")).GET().build(),
                java.net.http.HttpResponse.BodyHandlers.ofString());
        assertEquals(401,status.statusCode());
        var csrf=client.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create(base+"/api/csrf")).GET().build(),
                java.net.http.HttpResponse.BodyHandlers.ofString());
        var token=mapper.readTree(csrf.body());
        String signup=mapper.writeValueAsString(java.util.Map.of("email",UUID.randomUUID()+"@realtime.test","password","realtime-test-password","name","Owner"));
        var registered=client.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create(base+"/api/auth/signup"))
                .header("Content-Type","application/json").header(token.path("headerName").asText(),token.path("token").asText())
                .POST(java.net.http.HttpRequest.BodyPublishers.ofString(signup)).build(),java.net.http.HttpResponse.BodyHandlers.ofString());
        assertEquals(201,registered.statusCode(),registered.body());
        String body="{\"sdp\":\"v=0\\r\\nfake\"}";
        var forbidden=client.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create(base+"/api/assistant/realtime/sessions"))
                .header("Content-Type","application/json").POST(java.net.http.HttpRequest.BodyPublishers.ofString(body)).build(),
                java.net.http.HttpResponse.BodyHandlers.ofString());
        assertEquals(403,forbidden.statusCode());
        csrf=client.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create(base+"/api/csrf")).GET().build(),java.net.http.HttpResponse.BodyHandlers.ofString());
        token=mapper.readTree(csrf.body());
        var created=client.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create(base+"/api/assistant/realtime/sessions"))
                .header("Content-Type","application/json").header(token.path("headerName").asText(),token.path("token").asText())
                .POST(java.net.http.HttpRequest.BodyPublishers.ofString(body)).build(),java.net.http.HttpResponse.BodyHandlers.ofString());
        assertEquals(201,created.statusCode(),created.body());
        assertTrue(created.headers().firstValue("Cache-Control").orElse("").contains("no-store"));
        assertFalse(created.body().contains("api-key"));
    }

    @Test void expiredSessionsRefuseFurtherTurns() {
        Clock mutable=mock(Clock.class);
        Instant now=Instant.parse("2026-11-28T08:00:00Z");
        when(mutable.instant()).thenReturn(now);
        when(mutable.getZone()).thenReturn(ZoneId.of("Asia/Singapore"));
        var service=new RealtimeService(provider,proposals,assistant,tools,prep,rate,usage,mapper,mutable);
        String id=service.start(owner,new Start("v=0\r\nfake")).sessionId();
        when(mutable.instant()).thenReturn(now.plusSeconds(901));
        code("REALTIME_SESSION_EXPIRED", () -> service.turn(owner,id,new Turn("late",1,"save")));
    }
}
