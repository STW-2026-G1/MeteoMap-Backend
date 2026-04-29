const User = require("../models/User");
const logger = require("../config/logger");

class AdminService {
  serializeUser(user) {
    const plainUser = user.toObject({ virtuals: true });

    return {
      id: plainUser._id.toString(),
      email: plainUser.datos_acceso?.email,
      nombre: plainUser.perfil?.nombre || "",
      avatar_style: plainUser.perfil?.avatar_style || "avataaars",
      avatar_seed: plainUser.perfil?.avatar_seed || plainUser.perfil?.nombre || plainUser._id.toString(),
      avatar_url: plainUser.perfil?.avatar_url,
      estado: plainUser.estado,
      rol: plainUser.datos_acceso?.rol,
      provider: plainUser.datos_acceso?.provider,
      biografia: plainUser.perfil?.biografia || "",
      ubicacion: plainUser.perfil?.ubicacion || "",
      createdAt: plainUser.createdAt,
      updatedAt: plainUser.updatedAt,
      fechaEliminacion: plainUser.fechaEliminacion,
    };
  }

  async getUsers() {
    try {
      const users = await User.find({
        "datos_acceso.rol": { $ne: "ADMIN" },
      }).sort({ createdAt: -1 });

      return {
        total: users.length,
        users: users.map((user) => this.serializeUser(user)),
      };
    } catch (err) {
      logger.error(`Error en adminService.getUsers: ${err.message}`);
      throw err;
    }
  }

  async updateUser(userId, updateData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      if (user.datos_acceso?.rol === "ADMIN") {
        const error = new Error("No se puede editar un usuario administrador");
        error.status = 403;
        throw error;
      }

      // Solo permitir editar usuarios ACTIVO
      if (user.estado === "ELIMINADO") {
        const error = new Error("No se puede editar un usuario eliminado");
        error.status = 400;
        throw error;
      }

      const { nombre, email, estado, biografia, ubicacion, avatar_style } = updateData;

      if (email && email !== user.datos_acceso.email) {
        const existingUser = await User.findOne({
          "datos_acceso.email": email,
          _id: { $ne: user._id },
          estado: "ACTIVO",
        });

        if (existingUser) {
          const error = new Error("El email ya está registrado");
          error.status = 400;
          throw error;
        }

        user.datos_acceso.email = email;
      }

      if (nombre !== undefined) {
        user.perfil.nombre = nombre;
        user.perfil.avatar_seed = nombre;
      }

      // Solo permitir estado ACTIVO en edición (no se puede forzar ELIMINADO aquí)
      if (estado !== undefined && estado === "ACTIVO") {
        user.estado = estado;
      }

      if (biografia !== undefined) {
        user.perfil.biografia = biografia;
      }

      if (ubicacion !== undefined) {
        user.perfil.ubicacion = ubicacion;
      }

      if (avatar_style !== undefined) {
        user.perfil.avatar_style = avatar_style;
      }

      await user.save();

      logger.info(`Usuario actualizado desde admin: ${userId}`);

      return {
        message: "Usuario actualizado correctamente",
        user: this.serializeUser(user),
      };
    } catch (err) {
      logger.error(`Error en adminService.updateUser: ${err.message}`);
      throw err;
    }
  }

  async deleteUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      if (user.datos_acceso?.rol === "ADMIN") {
        const error = new Error("No se puede eliminar un usuario administrador");
        error.status = 403;
        throw error;
      }

      if (user.estado === "ELIMINADO") {
        const error = new Error("El usuario ya estaba eliminado");
        error.status = 400;
        throw error;
      }

      user.estado = "ELIMINADO";
      user.fechaEliminacion = new Date();
      await user.save();

      logger.warn(`Usuario eliminado desde admin: ${userId} (${user.datos_acceso.email})`);

      return {
        message: "Usuario eliminado correctamente",
        userId,
      };
    } catch (err) {
      logger.error(`Error en adminService.deleteUser: ${err.message}`);
      throw err;
    }
  }

  async restoreUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      if (user.datos_acceso?.rol === "ADMIN") {
        const error = new Error("No se puede restaurar un usuario administrador");
        error.status = 403;
        throw error;
      }

      if (user.estado !== "ELIMINADO") {
        const error = new Error("El usuario no está eliminado");
        error.status = 400;
        throw error;
      }

      user.estado = "ACTIVO";
      user.fechaEliminacion = null;
      await user.save();

      logger.info(`Usuario restaurado desde admin: ${userId} (${user.datos_acceso.email})`);

      return {
        message: "Usuario restaurado correctamente",
        user: this.serializeUser(user),
      };
    } catch (err) {
      logger.error(`Error en adminService.restoreUser: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new AdminService();