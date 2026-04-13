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
          id: newUser._id,
          email: newUser.datos_acceso.email,
          nombre: newUser.perfil.nombre,
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
        const error = new Error("Usuario bloqueado");
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
          id: user._id,
          email: user.datos_acceso.email,
          nombre: user.perfil.nombre,
          rol: user.datos_acceso.rol,
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
}

module.exports = new AuthService();
