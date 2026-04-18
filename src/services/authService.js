const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../models/User");
const tokenService = require("./tokenService");
const emailService = require("./emailService");
const logger = require("../config/logger");

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Servicio de autenticación
 * Contiene lógica de negocio para registro y login
 */
class AuthService {
  /**
   * Registrar nuevo usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña en texto plano
   * @param {string} nombre - Nombre del usuario
   * @param {string} avatar_style - Estilo del avatar
   * @returns {object} Usuario creado
   */
  async register(email, password, nombre, avatar_style = 'avataaars') {
    try {
      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({
        "datos_acceso.email": email.toLowerCase(),
      });

      if (existingUser) {
        const error = new Error("El email ya está registrado");
        error.status = 400;
        throw error;
      }

      // Hashear contraseña
      let passwordHash;
      try {
        passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      } catch (hashErr) {
        logger.error("Error hashing password during registration", {
          error: hashErr.message,
        });
        throw new Error("Error en el proceso de registro");
      }

      // Crear nuevo usuario
      const newUser = new User({
        datos_acceso: {
          email: email.toLowerCase(),
          password_hash: passwordHash,
          rol: "USER",
          provider: "local",
        },
        perfil: {
          nombre: nombre || "",
          avatar_seed: nombre || "",
          avatar_style: avatar_style,
        },
      });

      await newUser.save();
      logger.info(`Usuario registrado exitosamente`, {
        email: newUser.datos_acceso.email,
        userId: newUser._id,
      });

      return {
        message: "Usuario registrado exitosamente",
        user: {
          id: newUser._id.toString(),
          email: newUser.datos_acceso.email,
          nombre: newUser.perfil.nombre,
          avatar_style: newUser.perfil.avatar_style,
          avatar_seed: newUser.perfil.avatar_seed,
          rol: newUser.datos_acceso.rol,
          createdAt: newUser.createdAt,
        },
      };
    } catch (err) {
      throw err;
    }
  }

  /**
   * Iniciar sesión con email y contraseña
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña en texto plano
   * @returns {object} Token y datos del usuario
   */
  async loginWithEmail(email, password) {
    try {
      // Buscar usuario por email
      const user = await User.findOne({
        "datos_acceso.email": email.toLowerCase(),
      });

      if (!user) {
        const error = new Error("Credenciales inválidas");
        error.status = 401;
        throw error;
      }

      // Verificar que el usuario no esté bloqueado
      if (user.estado === "BLOQUEADO") {
        logger.warn(`Intento de login en cuenta bloqueada: ${email}`);
        const error = new Error("Usuario bloqueado");
        error.status = 403;
        throw error;
      }

      // Verificar que el usuario no esté eliminado
      if (user.estado === "ELIMINADO") {
        logger.warn(`Intento de login en cuenta eliminada: ${email}`);
        const error = new Error("La cuenta ha sido eliminada. Contacta con soporte para recuperarla");
        error.status = 403;
        throw error;
      }

      // Verificar que el usuario usa auth local
      if (user.datos_acceso.provider !== "local") {
        const error = new Error("Este usuario no usa autenticación con contraseña");
        error.status = 400;
        throw error;
      }

      // Comparar contraseña
      const passwordMatch = await bcrypt.compare(
        password,
        user.datos_acceso.password_hash
      );

      if (!passwordMatch) {
        const error = new Error("Credenciales inválidas");
        error.status = 401;
        throw error;
      }

      // Generar token
      const accessToken = tokenService.generateSingleJWT({
        userId: user._id.toString(),
        email: user.datos_acceso.email,
        rol: user.datos_acceso.rol,
      });

      logger.info(`Login exitoso`, {
        email: user.datos_acceso.email,
        userId: user._id,
      });

      return {
        message: "Login exitoso",
        accessToken,
        user: {
          id: user._id.toString(),
          email: user.datos_acceso.email,
          nombre: user.perfil.nombre,
          avatar_style: user.perfil.avatar_style,
          avatar_seed: user.perfil.avatar_seed,
          biografia: user.perfil.biografia,
          ubicacion: user.perfil.ubicacion,
          rol: user.datos_acceso.rol,
          createdAt: user.createdAt,
        },
      };
    } catch (err) {
      throw err;
    }
  }

  /**
   * Logout (principalmente para limpiar cliente)
   */
  logout() {
    logger.info("Usuario cerró sesión");
    return {
      message: "Sesión cerrada exitosamente",
    };
  }

  /**
   * Solicitar recuperación de contraseña
   * @param {string} email - Email del usuario
   * @returns {object} Mensaje de confirmación genérico
   */
  async forgotPassword(email) {
    try {
      // Buscar usuario por email
      const user = await User.findOne({
        "datos_acceso.email": email.toLowerCase(),
      });

      // Respuesta genérica (no revelar si el email existe)
      const genericMessage = {
        message: "Si el correo existe en nuestro sistema, recibirás un email con instrucciones para recuperar tu contraseña",
      };

      // Si el usuario no existe, retornar mensaje genérico
      if (!user) {
        logger.warn(`Intento de recuperación con email no registrado: ${email}`);
        return genericMessage;
      }

      // Generar token criptográficamente seguro
      const resetToken = crypto.randomBytes(32).toString("hex");

      // Hashear el token antes de guardarlo en BD
      const tokenHash = await bcrypt.hash(resetToken, BCRYPT_SALT_ROUNDS);

      // Guardar token hasheado en la BD
      user.passwordResetToken = tokenHash;
      await user.save();

      // Enviar email con el token en plain text (solo en el email, no en BD)
      await emailService.sendPasswordResetEmail(email, resetToken);

      logger.info(`Solicitud de recuperación de contraseña`, {
        email: user.datos_acceso.email,
        userId: user._id,
      });

      return genericMessage;
    } catch (err) {
      logger.error("Error en forgotPassword", {
        email,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Restablecer contraseña con token
   * @param {string} token - Token de recuperación en plain text
   * @param {string} newPassword - Nueva contraseña
   * @returns {object} Mensaje de confirmación
   */
  async resetPassword(token, newPassword) {
    try {
      // Buscar usuario con token válido
      const users = await User.find({
        passwordResetToken: { $ne: null },
      });

      let userFound = null;

      // Comparar token con hasheados guardados (es lento pero seguro)
      for (const user of users) {
        const isTokenValid = await bcrypt.compare(token, user.passwordResetToken);
        if (isTokenValid) {
          userFound = user;
          break;
        }
      }

      if (!userFound) {
        const error = new Error("Token de recuperación inválido o expirado");
        error.status = 400;
        throw error;
      }

      // Hashear la nueva contraseña
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

      // Actualizar contraseña e invalidar token
      userFound.datos_acceso.password_hash = passwordHash;
      userFound.passwordResetToken = null;
      await userFound.save();

      logger.info(`Contraseña recuperada exitosamente`, {
        email: userFound.datos_acceso.email,
        userId: userFound._id,
      });

      return {
        message: "Contraseña actualizada correctamente",
      };
    } catch (err) {
      logger.error("Error en resetPassword", {
        error: err.message,
      });
      throw err;
    }
  }
}

module.exports = new AuthService();
