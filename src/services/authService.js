const bcrypt = require("bcrypt");
const User = require("../models/User");
const tokenService = require("./tokenService");
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
   * @returns {object} Usuario creado
   */
  async register(email, password, nombre) {
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
          id: newUser._id,
          email: newUser.datos_acceso.email,
          nombre: newUser.perfil.nombre,
        },
      };
    } catch (err) {
      logger.error(`Error en register: ${err.message}`);
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
        logger.warn(`Login fallido: usuario no encontrado`, { email });
        const error = new Error("Credenciales inválidas");
        error.status = 401;
        throw error;
      }

      // Verificar que el usuario no esté bloqueado
      if (user.estado === "BLOQUEADO") {
        logger.warn(`Intento de login de usuario bloqueado`, {
          email,
          userId: user._id,
        });
        const error = new Error("Usuario bloqueado");
        error.status = 403;
        throw error;
      }

      // Verificar que el usuario usa auth local
      if (user.datos_acceso.provider !== "local") {
        logger.warn(`Login fallido: usuario no usa auth local`, {
          email,
          provider: user.datos_acceso.provider,
        });
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
        logger.warn(`Login fallido: contraseña incorrecta`, { email });
        const error = new Error("Credenciales inválidas");
        error.status = 401;
        throw error;
      }

      // Generar token
      const accessToken = tokenService.generateTokenPair({
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
          id: user._id,
          email: user.datos_acceso.email,
          nombre: user.perfil.nombre,
          rol: user.datos_acceso.rol,
        },
      };
    } catch (err) {
      logger.error(`Error en loginWithEmail: ${err.message}`);
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
}

module.exports = new AuthService();
