"use strict";

// Baseline schema: reproduces exactly what `sequelize.sync()` created from the models
// (7 tables, primary keys, 9 foreign keys). Replaces the original incomplete migrations.
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const timestamps = {
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      };

      await queryInterface.createTable(
        "Users",
        {
          id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },
          email: { type: Sequelize.STRING },
          username: { type: Sequelize.STRING },
          bio: { type: Sequelize.TEXT },
          image: { type: Sequelize.TEXT },
          password: { type: Sequelize.STRING },
          ...timestamps,
        },
        { transaction },
      );

      await queryInterface.createTable(
        "Tags",
        {
          name: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
        },
        { transaction },
      );

      await queryInterface.createTable(
        "Articles",
        {
          id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },
          slug: { type: Sequelize.STRING },
          title: { type: Sequelize.STRING },
          description: { type: Sequelize.TEXT },
          body: { type: Sequelize.TEXT },
          ...timestamps,
          userId: {
            type: Sequelize.INTEGER,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
        },
        { transaction },
      );

      await queryInterface.createTable(
        "Comments",
        {
          id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },
          body: { type: Sequelize.TEXT },
          ...timestamps,
          articleId: {
            type: Sequelize.INTEGER,
            references: { model: "Articles", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          userId: {
            type: Sequelize.INTEGER,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
        },
        { transaction },
      );

      await queryInterface.createTable(
        "Favorites",
        {
          articleId: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            allowNull: false,
            references: { model: "Articles", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          userId: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            allowNull: false,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
        },
        { transaction },
      );

      await queryInterface.createTable(
        "Followers",
        {
          userId: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            allowNull: false,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          followerId: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            allowNull: false,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
        },
        { transaction },
      );

      await queryInterface.createTable(
        "TagList",
        {
          articleId: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            allowNull: false,
            references: { model: "Articles", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          tagName: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false,
            references: { model: "Tags", key: "name" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
        },
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const table of [
        "TagList",
        "Followers",
        "Favorites",
        "Comments",
        "Articles",
        "Tags",
        "Users",
      ]) {
        await queryInterface.dropTable(table, { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
