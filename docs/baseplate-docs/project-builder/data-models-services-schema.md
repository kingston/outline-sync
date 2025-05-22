---
title: Data Models / Services / Schema
outlineId: c2e73dde-58ad-4152-86dc-2d989fda7046
sidebar:
  order: 4
---
On the Data Model page, Baseplate allows you to configure the data models and what CRUD operations will be exposed to clients of the backend. You specify a name and what module the model will live in and define if the model needs services (like create, update, delete operations) and a GraphQL schema (to add it to the backend GraphQL schema).

### Data Models

Data models define the structure of the data within an application that will be stored in your database. Each data model has a set of fields and optionally relationships to other data models. For example, a todo list data model might have a field for `id`, `name`, and `ownerId` (which represents the ID of the user data model who owns the todo list).

 ![](/api/attachments.redirect?id=4fba1872-7f67-42ac-9d4b-5712197d0253)

You can specify:

* **Relations:** Relations are foreign-key relations from this data model to another data model. They allow rows in this data model to reference rows in another model, e.g. the ownerId of a model.
* **Primary Keys:** Primary keys are a special type of database column designed to uniquely identify each row in a table. Every table must have a primary key, and the values within this column must be unique and not null. Typically, other foreign relations use the primary key of the table to refer to a specific row in the table e.g. `ownerId` refers to the primary key of the `user` table. In some cases, you can have a primary key that is made up of two columns, e.g. `userId` and `roleId` where the row is identified by the combination of two different columns.
* **Unique Constraints:** Unique constraints ensure that all values in a column or a set of columns are different from one another across all the rows within the database table. This means no two rows can have the same value for the columns that are declared as unique, which helps maintain data integrity by preventing duplicate entries.

In the future, we will support:

* **Indicies:** Indices (or indexes) are used to speed up the retrieval of data from a database table. An index is created on one or more columns in a table. When an index is created, the database builds a data structure that allows it to quickly locate the data associated with the indexed column(s), significantly reducing the amount of data that has to be scanned during queries.

### Controller Service

A controller is a file with simple functions that allow the developer to operate on the data models in a simplified manner for creating, updating, and deleting rows. These functions can then be called by the GraphQL schema to modify the table's contents.

When you check Build controller, you tell Baseplate to create the controller file and the remaining options allow you to customize the functions. You can pick which fields the user can specify when they create or update a row e.g. you can allow them to update the name of the To Do list but not the createdAt field.

 ![](/api/attachments.redirect?id=2fd8c2ad-0590-4442-b22a-bdd68ac58e36)

### Transformers

Normally, when we specify a field in the list of createable/updateable fields, the value of the field will translate one to one with a field in the row. However, occasionally we need to add additional functionality to the service function so that it can modify more than just the row. This additional functionality is called transformers (TBD for better naming).

Transformers take a new input field, e.g. coverPhoto, that doesn't exist in the original row and performs additional operations and transforms the field for a specific purpose depending on the transformer. There are three transformers currently supported:

* **Password:** A password transformer will add a new input field called `password` to the service function, create a one-way hash of the `password` field, and save it to a field called `passwordHash` on the row.
* **Embedded Relation:** The embedded relation transformer will add a new input field with the name of the foreign relation, e.g. `roles` for a user row. This input field takes an array of desired `roles` for that user, e.g. `[{ role: 'admin' }]` and transforms it into a series of operations that deletes any role for the user that is not in the array and updates/creates any role that does not exist already, ensuring that the user has that set of roles. This is useful when you need to update data in an associated table from just one operation in the current tale. (e.g. the `userRoles` table when updating the `user` table)
* **File:** The file transformer will add a new input field with the name of the File relation. All files in Baseplate projects are represented by a row in the File table. When you upload a file, we create a row in the File table first and the user receives the ID for the file row. Then the user can upload the file with that ID into our file storage system. Once uploaded, the user can then call the service function with the ID of the file which gets passed into the file transformer. The file transformer will validate that the ID of the file matches the uploaded file and save the ID to the row. For example, the user can upload a `coverPhoto` to their profile by getting a new ID for a file, uploading the file with that ID, and calling `updateUser` service with the new ID they just received.

### GraphQL Schema

The GraphQL schema defines the operations (queries and mutations) that can be executed by the clients of your application, and it describes the types of data that can be fetched from your server.

 ![](/api/attachments.redirect?id=10022492-94ee-47ca-ab71-2921f652bb21)

There are several components:

* **Object Type:** The Object Type is a component of the GraphQL schema that defines a group of related fields e.g. a `User` object type. These fields can be scalars fields (e.g. a string or boolean) or relations to other object types (e.g. list of `Role`). Each object type represents a type of entity your API can provide information about, for example, a User or a Product.
* **Exposed Fields:** Exposed fields refer to the fields of an Object Type that are accessible to the GraphQL clients. These fields define what information can be queried via the GraphQL API. For example, in a `**User**` object type, exposed fields might include `**id**`, `**name**`, and `**email**`.
* **Exposed Local Relations:** Exposed local relations define the relationships between fields of the data model and other data models. For example, if the data model has a `userId` field, you will be able to expose the associated `user` object type from the GraphQL schema.
* **Exposed Foreign Relations:** Exposed foreign relations is the inverse of exposed local relations. If another data model has a field that refers to this data model, you can expose the reverse connection from this data model's object type. For example, the `user` object type can expose `todoLists` to get all the `todoList` rows that have a `userId` equal to that user.
* **Build Query?:** This component determines whether read-only access (queries) should be available for a particular type in the GraphQL API. If enabled, clients can query data for this type. For example, setting this to `**true**` for a `**Product**` type would allow clients to retrieve product details.
* **Build Mutations?**: Similar to `**Build Query?**`, this setting decides whether mutations (create, update, delete operations) are enabled for a type in the GraphQL schema. Enabling this allows clients to modify data of the type. For example, allowing mutations on a `**User**` type would enable features like creating new users, updating user information, or deleting users.
