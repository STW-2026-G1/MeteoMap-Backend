const { OAuth2Client } = require("google-auth-library");
const logger = require("../config/logger");

/**
 * Validador de tokens OAuth2
 */

/**
 * Decodifica y valida un ID Token de Google
 *
 * @param {string} idToken - Token ID de Google
 * @param {string} clientId - Google Client ID
 * @returns {object} Payload del token decodificado
 */
async function verifyGoogleToken(idToken, clientId) {
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    return ticket.getPayload();
  } catch (err) {
    logger.error(`Error verificando token de Google: ${err.message}`);
    throw err;
  }
}

/**
 * Intercambia el código por un access_token de GitHub y obtiene los datos del usuario
 * 
 * @param {string} code - Authorization code devuelto por GitHub
 * @param {string} clientId - GitHub Client ID
 * @param {string} clientSecret - GitHub Client Secret
 * @returns {object} Datos del usuario de GitHub (id, email, name, login, avatar_url)
 */
async function verifyGithubCode(code, clientId, clientSecret) {
  try {
    // 1. Obtener access token de GitHub
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      throw new Error(`Error de autenticación en GitHub: ${tokenData.error_description || tokenData.error}`);
    }

    const { access_token } = tokenData;
    if (!access_token) {
      throw new Error("No se pudo obtener el access_token de GitHub");
    }

    // 2. Obtener datos del usuario
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      throw new Error("Error obteniendo el perfil del usuario de GitHub");
    }

    const userData = await userResponse.json();

    // 3. Obtener el email real si es privado o no está en el objeto de profile principal
    if (!userData.email) {
      const emailResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (emailResponse.ok) {
        const emails = await emailResponse.json();
        const primaryEmail = emails.find(e => e.primary && e.verified);
        if (primaryEmail) {
          userData.email = primaryEmail.email;
        } else if (emails.length > 0 && emails[0].verified) {
          userData.email = emails[0].email;
        }
      }
    }

    return userData;
  } catch (err) {
    logger.error(`Error verificando código de GitHub: ${err.message}`);
    throw err;
  }
}

module.exports = {
  verifyGoogleToken,
  verifyGithubCode,
};
