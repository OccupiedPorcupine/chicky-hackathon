package app.account;

import app.service.GoogleAuthService;
import app.service.PublicHolidaySyncService;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

// The first-sign-in welcome (issue #25): a new account hasn't seen it, and once it is marked seen
// every later sign-in, on any device, says so. Real HTTP and a real (H2) database.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WelcomeSeenApiTest {

    private static final String PASSWORD = "a-long-unique-password";

    @MockitoBean
    PublicHolidaySyncService publicHolidaySyncService;

    @MockitoBean
    EmailSender emailSender;

    @MockitoBean
    GoogleAuthService googleAuthService;

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    @AfterEach
    void deleteTestRows() {
        jdbc.update("DELETE FROM account_tokens WHERE user_id IN (SELECT id FROM app_users WHERE email LIKE '%@welcome.test')");
    }

    @Test
    void aNewAccountSeesTheWelcomeOnceThenNeverAgain() throws Exception {
        Session device = new Session();
        HttpResponse<String> signup = device.send("POST", "/api/auth/signup",
                "{\"email\":\"new@welcome.test\",\"password\":\"" + PASSWORD + "\",\"name\":\"Stall owner\"}");
        assertEquals(201, signup.statusCode(), signup.body());
        assertTrue(signup.body().contains("\"welcomeSeen\":false"), signup.body());
        assertTrue(device.get("/api/profile").body().contains("\"welcomeSeen\":false"));

        assertEquals(204, device.send("POST", "/api/profile/welcome-seen", null).statusCode());
        assertTrue(device.get("/api/profile").body().contains("\"welcomeSeen\":true"));
        // Marking it again changes nothing.
        assertEquals(204, device.send("POST", "/api/profile/welcome-seen", null).statusCode());

        // Another device signs in to the same account: straight to the Dashboard.
        HttpResponse<String> login = new Session().send("POST", "/api/auth/login",
                "{\"email\":\"new@welcome.test\",\"password\":\"" + PASSWORD + "\"}");
        assertEquals(200, login.statusCode(), login.body());
        assertTrue(login.body().contains("\"welcomeSeen\":true"), login.body());
    }

    @Test
    void aFirstGoogleSignInHasNotSeenTheWelcome() throws Exception {
        GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
        payload.setSubject("google-welcome");
        payload.setEmail("google@welcome.test");
        payload.set("name", "Google owner");
        when(googleAuthService.verifyToken("welcome-credential")).thenReturn(payload);

        Session device = new Session();
        HttpResponse<String> first = device.send("POST", "/api/auth/google", "{\"credential\":\"welcome-credential\"}");
        assertEquals(200, first.statusCode(), first.body());
        assertTrue(first.body().contains("\"welcomeSeen\":false"), first.body());

        assertEquals(204, device.send("POST", "/api/profile/welcome-seen", null).statusCode());
        HttpResponse<String> again = new Session().send("POST", "/api/auth/google", "{\"credential\":\"welcome-credential\"}");
        assertTrue(again.body().contains("\"welcomeSeen\":true"), again.body());
    }

    @Test
    void markingTheWelcomeNeedsASignedInUser() throws Exception {
        assertEquals(401, new Session().send("POST", "/api/profile/welcome-seen", null).statusCode());
    }

    private final class Session {
        final HttpClient http = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();

        HttpResponse<String> get(String path) throws Exception {
            return http.send(HttpRequest.newBuilder(uri(path)).GET().build(), HttpResponse.BodyHandlers.ofString());
        }

        HttpResponse<String> send(String method, String path, String body) throws Exception {
            String csrf = get("/api/csrf").body();
            Matcher matcher = Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"").matcher(csrf);
            assertTrue(matcher.find(), csrf);
            return http.send(HttpRequest.newBuilder(uri(path))
                            .header("Content-Type", "application/json")
                            .header("X-XSRF-TOKEN", matcher.group(1))
                            .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());
        }

        URI uri(String path) {
            return URI.create("http://localhost:" + port + path);
        }
    }
}
