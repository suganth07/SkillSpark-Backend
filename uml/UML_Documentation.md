# SkillSpark Backend - UML Diagrams Documentation

This document contains comprehensive UML diagrams for the SkillSpark backend system, following **strict UML 2.5 standards**. These diagrams provide visual representations of the database structure, service architecture, system flows, and use cases.

## 📋 UML Standards & Rules Followed

This documentation adheres to the **Unified Modeling Language (UML) 2.5 specification** as defined by the Object Management Group (OMG). All diagrams follow strict UML conventions for professional software engineering documentation.

### 🎯 Core UML Principles Applied

1. **Consistency**: All notation follows UML metamodel standards
2. **Clarity**: Clear visual separation of different element types
3. **Completeness**: Full method signatures with parameters and return types
4. **Correctness**: Proper use of UML stereotypes and relationships
5. **Professional Standards**: Industry-standard formatting and notation

---

## 📊 Diagram Overview

The following UML diagrams are included, each following specific UML diagram standards:

1. **Database Class Diagram** (`database_erd.puml`) - UML Class Diagram for Entity Modeling
2. **Service Architecture** (`service_architecture.puml`) - UML Class Diagram for System Architecture
3. **Roadmap Creation Sequence** (`roadmap_creation_sequence.puml`) - UML Sequence Diagram
4. **Use Cases** (`use_cases.puml`) - UML Use Case Diagram

---

## 🗄️ 1. Database Class Diagram (Entity Modeling)

**File**: `database_erd.puml`

### UML Standards Applied

#### ✅ Class Notation Rules

- **Class Names**: PascalCase (User, UserTopic, UserRoadmap)
- **Attribute Visibility**: Private (-), Public (+)
- **Method Signatures**: Complete with parameters and return types
- **Stereotypes**: Proper PK/FK annotations using UML constraints
- **Data Types**: Explicit typing (Integer, String, DateTime, JSON)

#### ✅ Relationship Rules

- **Association**: Solid lines with proper multiplicity (||--o{, ||--||)
- **Composition**: Used where appropriate for strong ownership
- **Multiplicity**: Correct notation (1, 0..1, 0.._, 1.._)
- **Role Names**: Clear relationship labeling ("owns", "contains", "tracks")

#### ✅ UML Constraints

```
{PK} - Primary Key constraint
{FK} - Foreign Key constraint
{unique} - Unique constraint
{nullable} - Nullable attribute
```

### Purpose

Represents database entities as UML classes with proper object-oriented modeling principles, showing data persistence layer of the application.

### Key Entities

- **User**: Core authentication entity with identity management
- **UserTopic**: Learning subject aggregation entity
- **UserRoadmap**: Learning path composition with JSON document storage
- **UserVideo**: Media content entity with pagination behavior
- **RoadmapProgress**: Progress tracking association entity
- **UserSettings**: User preference value object

### UML Relationships Applied

- **One-to-Many**: User → UserTopic (1 to 0..\*)
- **One-to-One**: User → UserSettings (1 to 0..1)
- **Association Class**: RoadmapProgress linking User and UserRoadmap
- **Composition**: Strong ownership relationships where child cannot exist without parent

---

## 🏗️ 2. Service Architecture Class Diagram

**File**: `service_architecture.puml`

### UML Standards Applied

#### ✅ Class Diagram Rules

- **Interface Definition**: Proper <<interface>> stereotype usage
- **Implementation Relationship**: Dashed lines with hollow triangles (realizes)
- **Dependency Relationship**: Dashed arrows showing "uses" relationships
- **Package Organization**: Logical grouping with <<Folder>> stereotype
- **Access Modifiers**: Correct visibility notation (+, -, #, ~)

#### ✅ Method Signatures (UML Standard)

```
+ methodName(parameter : Type) : ReturnType
- privateMethod() : void
{static} + staticMethod(param : Type) : Type
```

#### ✅ Stereotypes Used

- **<<Controller>>**: MVC controller classes
- **<<interface>>**: Contract definitions
- **<<Utility>>**: Helper/utility classes
- **<<Folder>>**: Package organization

### Purpose

Shows the layered architecture and service relationships following object-oriented design patterns and dependency injection principles.

### Architecture Layers

#### Controllers Package

- **Responsibility**: HTTP request handling and response formatting
- **Pattern**: MVC Controller pattern
- **Dependencies**: Services through dependency injection

#### Services Package

- **DatabaseService Interface**: Contract for data access operations
- **Implementation Classes**: Strategy pattern for different database providers
- **External Services**: Integration with third-party APIs (Gemini, YouTube)

#### Models Package

- **Response Objects**: Data Transfer Objects (DTOs) for API responses
- **Pattern**: Value Objects pattern

#### Utilities Package

- **Cross-cutting Concerns**: Logging, security, helper functions
- **Pattern**: Utility/Helper pattern with static methods

### UML Design Patterns Demonstrated

- **Strategy Pattern**: Multiple DatabaseService implementations
- **Repository Pattern**: Database abstraction through interfaces
- **Dependency Injection**: Controller dependencies on service interfaces
- **Interface Segregation**: Clean separation of concerns

---

## 🔄 3. Roadmap Creation Sequence Diagram

**File**: `roadmap_creation_sequence.puml`

### UML Standards Applied

#### ✅ Sequence Diagram Rules

- **Lifelines**: Proper participant declaration with type notation
- **Messages**: Complete method signatures with parameters
- **Activation Boxes**: Show object activation periods
- **Return Messages**: Explicit return types and values
- **Combined Fragments**: Standard opt, alt, loop notation
- **Notes**: Contextual information for complex operations

#### ✅ Message Types

```
→ : Synchronous message
→ : Asynchronous message
← : Return message
→ : Self-message
```

#### ✅ Combined Fragments

- **opt**: Optional execution block
- **alt/else**: Alternative execution paths
- **loop**: Iteration blocks
- **ref**: Reference to other diagrams

### Purpose

Illustrates the complete interaction flow for roadmap generation and persistence, showing temporal ordering of operations and system collaboration.

### Interaction Patterns

- **Request-Response**: HTTP API communication patterns
- **Service Orchestration**: Multi-service coordination
- **Conditional Logic**: Business rule implementation
- **Transaction Management**: Database operation sequencing
- **External Integration**: AI service communication

### UML Sequence Rules Applied

1. **Time Ordering**: Top-to-bottom temporal flow
2. **Participant Types**: Clear object/service identification
3. **Message Semantics**: Complete operation signatures
4. **Return Values**: Explicit type information
5. **Activation Management**: Proper lifecycle representation

---

## 👥 4. Use Case Diagram

**File**: `use_cases.puml`

### UML Standards Applied

#### ✅ Use Case Diagram Rules

- **Actor Definition**: Primary and secondary actors
- **Use Case Notation**: Ellipse shapes with descriptive names
- **Association**: Simple lines between actors and use cases
- **Include Relationship**: <<include>> stereotype with dashed arrows
- **Extend Relationship**: <<extend>> stereotype with dashed arrows pointing to base use case
- **System Boundary**: Rectangle defining system scope

#### ✅ Relationship Types

```
→ : Association (actor to use case)
..> : Include dependency (required functionality)
<.. : Extend dependency (optional functionality)
```

#### ✅ Stereotypes Applied

- **<<include>>**: Mandatory sub-functionality
- **<<extend>>**: Optional enhancement functionality
- **System boundary**: Clear scope definition

### Purpose

Defines functional requirements and user-system interactions following use case modeling best practices for requirements engineering.

### Actor Roles

- **User**: Primary actor representing learners
- **Administrator**: Secondary actor for system management

### Use Case Categories

Organized by functional domains following domain-driven design principles:

1. **Authentication**: User identity management
2. **Learning Management**: Core learning functionality
3. **Video Content**: Media content management
4. **User Preferences**: Personalization features
5. **Data Management**: Data lifecycle operations
6. **Topic Management**: Subject area organization

### UML Use Case Rules Applied

1. **Actor Identification**: Clear role-based separation
2. **Functional Grouping**: Package organization by domain
3. **Relationship Semantics**: Proper include/extend usage
4. **System Scope**: Clear boundary definition
5. **Goal-Oriented**: Each use case represents user goal

---

## 📚 UML Learning Guide

### Essential UML Concepts

#### 1. **Visibility Notation**

```
+ public: Accessible from anywhere
- private: Only within the same class
# protected: Within class hierarchy
~ package: Within same package
```

#### 2. **Relationship Types**

```
Association: ———————————————— (uses/knows about)
Aggregation: ————————◇——————— (has-a, weak ownership)
Composition: ————————◆——————— (contains, strong ownership)
Inheritance: ———————————————▷ (is-a relationship)
Realization: ─ ─ ─ ─ ─ ─ ─ ▷ (implements interface)
Dependency:  ─ ─ ─ ─ ─ ─ ─ → (uses temporarily)
```

#### 3. **Multiplicity Notation**

```
1      : Exactly one
0..1   : Zero or one
0..*   : Zero or many
1..*   : One or many
5..10  : Between 5 and 10
*      : Many (shorthand for 0..*)
```

#### 4. **Stereotype Usage**

```
<<interface>>   : Interface definition
<<abstract>>    : Abstract class
<<enumeration>> : Enumeration type
<<utility>>     : Utility class
<<controller>>  : MVC controller
<<service>>     : Service layer
```

### Professional UML Best Practices

#### ✅ Do's

1. **Use Standard Notation**: Follow UML 2.5 specification exactly
2. **Complete Signatures**: Include parameter types and return types
3. **Consistent Naming**: Use established naming conventions
4. **Clear Relationships**: Show dependencies and associations clearly
5. **Proper Stereotypes**: Use standard UML stereotypes appropriately
6. **Package Organization**: Group related elements logically
7. **Constraint Documentation**: Use OCL or natural language constraints

#### ❌ Don'ts

1. **Avoid Custom Notation**: Don't invent your own symbols
2. **Incomplete Information**: Don't omit important details
3. **Inconsistent Style**: Maintain consistent formatting
4. **Overcomplicated Diagrams**: Keep diagrams focused and readable
5. **Wrong Relationships**: Don't misuse inheritance for composition
6. **Missing Context**: Always provide sufficient documentation

---

## 🛠️ How to Use These Diagrams

### For Learning UML

1. **Study Each Diagram**: Understand the specific UML rules applied
2. **Compare Standards**: See how each diagram type follows UML conventions
3. **Practice Notation**: Use these as templates for your own diagrams
4. **Reference Guide**: Use the UML rules section as a quick reference

### For Development

- **Database Design**: Use class diagram for schema planning and ORM mapping
- **Service Architecture**: Guide for dependency injection and layered architecture
- **Sequence Flow**: Understanding complex business processes and debugging
- **Use Cases**: Feature planning, requirements validation, testing scenarios

### For Documentation

- **Technical Specifications**: Professional UML diagrams for stakeholders
- **Architecture Reviews**: Visual aid for technical design discussions
- **Code Reviews**: Ensure implementation matches design intent
- **Training Materials**: Onboard new team members with visual documentation

---

## 🔍 UML Tools and Validation

### Recommended UML Tools

1. **PlantUML**: Text-based diagramming (used for these diagrams)
2. **Enterprise Architect**: Professional UML modeling
3. **Visual Paradigm**: Full UML suite with validation
4. **Lucidchart**: Collaborative diagramming
5. **Draw.io**: Free online diagramming

### UML Validation Checklist

#### Class Diagrams ✅

- [ ] Proper visibility notation (+, -, #, ~)
- [ ] Complete method signatures with types
- [ ] Correct relationship notation and multiplicity
- [ ] Appropriate use of stereotypes
- [ ] Clear package organization

#### Sequence Diagrams ✅

- [ ] Proper lifeline notation
- [ ] Complete message signatures
- [ ] Correct activation boxes
- [ ] Standard combined fragments (opt, alt, loop)
- [ ] Return message notation

#### Use Case Diagrams ✅

- [ ] Clear actor identification
- [ ] Proper use case notation (ellipses)
- [ ] Correct relationship stereotypes (include, extend)
- [ ] System boundary definition
- [ ] Logical functional grouping

---

## 📋 Diagram Maintenance Guidelines

### When to Update Diagrams

#### Database Class Diagram

- Schema changes (new tables, columns, relationships)
- Data type modifications
- Constraint changes
- Index strategy updates

#### Service Architecture

- New service implementations
- Interface modifications
- Dependency relationship changes
- Package restructuring

#### Sequence Diagrams

- API flow modifications
- New integration points
- Business logic changes
- Error handling updates

#### Use Case Diagrams

- New feature requirements
- Actor role changes
- Functional scope modifications
- System boundary updates

### Version Control Best Practices

1. **Commit with Code**: Update diagrams alongside implementation
2. **Review Process**: Include diagram review in code reviews
3. **Documentation Sync**: Ensure diagrams match current implementation
4. **Change Tracking**: Document significant architectural changes

### UML Quality Assurance

1. **Standards Compliance**: Regular validation against UML 2.5 specification
2. **Consistency Checks**: Ensure notation consistency across all diagrams
3. **Stakeholder Review**: Validate diagrams with technical and business stakeholders
4. **Tool Validation**: Use UML tools with built-in validation features

---

This comprehensive UML documentation serves as both a learning resource for UML standards and a professional reference for the SkillSpark backend architecture. All diagrams strictly follow UML 2.5 specifications and industry best practices for software engineering documentation.

### Purpose

Shows the layered architecture, service relationships, and dependency injection patterns used in the backend.

### Architecture Layers

#### Controllers/Routes

- **UserRoutes**: Handles user-related HTTP endpoints
- **RoadmapRoutes**: Manages roadmap generation endpoints
- **PlaylistRoutes**: Handles video playlist operations

#### Services

- **DatabaseService** (Interface): Defines common database operations
- **NeonDbService**: Implementation using Neon serverless PostgreSQL
- **SupabaseService**: Implementation using PostgreSQL connection pool
- **GeminiService**: AI service for generating roadmaps and video titles
- **YoutubeService**: Service for searching and filtering YouTube videos

#### Models

- **ResponseModels**: Standardized response objects and data transfer objects

#### Utilities

- **Helpers**: Common utility functions
- **Logger**: Application logging
- **Security**: Rate limiting and validation

### Design Patterns

- **Strategy Pattern**: Multiple database service implementations
- **Repository Pattern**: Database abstraction layer
- **Dependency Injection**: Services injected into controllers

---

## 🔄 3. Roadmap Creation Sequence Diagram

**File**: `roadmap_creation_sequence.puml`

### Purpose

Illustrates the complete flow of generating and saving a learning roadmap, from user request to database storage.

### Flow Steps

1. **User Request**: User requests roadmap for specific topic
2. **Preference Loading**: System loads user preferences if available
3. **AI Generation**: Gemini AI generates structured roadmap
4. **Response Transformation**: Raw AI response transformed to API response format
5. **Optional Save**: User can choose to save roadmap to their account
6. **Topic Management**: System creates or finds existing topic
7. **Roadmap Storage**: Creates new or updates existing roadmap in database

### Key Interactions

- **Conditional Logic**: User preferences, topic existence, roadmap updates
- **Database Transactions**: Multiple database operations for data consistency
- **External API Calls**: Integration with Gemini AI service
- **Error Handling**: Proper error propagation through layers

---

## 👥 4. Use Case Diagram

**File**: `use_cases.puml`

### Purpose

Defines the functional requirements and user interactions with the SkillSpark system.

### Actor Roles

- **User**: Primary system user (learners)
- **Admin**: System administrator (for data management)

### Use Case Categories

#### Authentication

- Register Account, Login, Check Username Availability

#### Learning Management

- Generate/Save/View/Update/Delete Roadmaps
- Track Progress, Mark Points Complete

#### Video Content

- Generate/Regenerate Video Playlists
- View Videos by Level, Paginate Results

#### User Preferences

- Manage Settings, Configure Learning Preferences
- Set Roadmap Depth, Video Length Preferences

#### Data Management

- Clear All Data, Delete Account, Export Progress

#### Topic Management

- Create/View/Search Learning Topics

### Relationship Types

- **Include**: Required sub-functionality
- **Extend**: Optional functionality based on conditions
- **Inheritance**: Admin extends User capabilities

---

## 🛠️ How to Use These Diagrams

### For Development

- **Database ERD**: Reference for schema changes, query optimization, index planning
- **Service Architecture**: Guide for adding new features, refactoring, dependency management
- **Sequence Diagram**: Understanding complex flows, debugging, performance analysis
- **Use Cases**: Feature planning, requirements validation, testing scenarios

### For Documentation

- **Onboarding**: Help new developers understand system structure
- **Architecture Reviews**: Visual aid for technical discussions
- **Stakeholder Communication**: Explain system capabilities to non-technical audiences

### Viewing the Diagrams

#### Option 1: PlantUML Online Server

```
http://www.plantuml.com/plantuml/uml/
```

Copy and paste the content of any `.puml` file into the online editor.

#### Option 2: VS Code Extension

Install the "PlantUML" extension and open any `.puml` file to preview.

#### Option 3: Local PlantUML Installation

```bash
# Install PlantUML
npm install -g node-plantuml

# Generate PNG from PUML file
puml generate database_erd.puml --png
```

#### Option 4: Online PlantUML Editor

```
https://plantuml-editor.kkeisuke.com/
```

---

## 🔄 Keeping Diagrams Updated

### When to Update

#### Database ERD

- Adding/removing tables
- Changing relationships
- Modifying column types or constraints

#### Service Architecture

- Adding new services or controllers
- Changing dependency relationships
- Refactoring service interfaces

#### Sequence Diagrams

- Modifying API flows
- Adding new integration points
- Changing business logic sequences

#### Use Cases

- Adding new features
- Changing user roles or permissions
- Modifying functional requirements

### Best Practices

- Update diagrams before implementing changes
- Review diagrams during code reviews
- Use diagrams for architecture discussions
- Keep diagrams in version control with code

---

## 📋 Diagram Legend

### Colors and Symbols

- **🔑 Primary Key**: Gold key symbol
- **🔗 Foreign Key**: Gray key symbol
- **📄 Column**: Record symbol
- **🏢 Table**: Entity box with table header
- **🔵 Service**: Blue circle with "S"
- **🟢 Controller**: Green circle with "C"
- **🟡 Model**: Yellow circle with "M"
- **⚫ Utility**: Gray circle with "U"

### Relationship Lines

- **Solid Line**: Direct relationship/dependency
- **Dashed Line**: Include/extend relationship
- **Arrow**: Direction of dependency
- **Diamond**: Composition relationship
- **Circle**: Interface implementation

---

## 🔍 Additional Analysis

### Database Optimization Insights

- **Indexing Strategy**: Based on query patterns shown in ERD
- **Normalization**: Proper 3NF structure with minimal redundancy
- **JSON Storage**: Flexible schema for dynamic roadmap/video data
- **Pagination Support**: Built-in support for large datasets

### Architecture Benefits

- **Separation of Concerns**: Clear layer boundaries
- **Scalability**: Multiple database service implementations
- **Maintainability**: Interface-based design
- **Testability**: Dependency injection patterns

### Performance Considerations

- **Database Connection Pooling**: Shown in PostgreSQL implementation
- **Caching Opportunities**: User settings, frequently accessed roadmaps
- **Async Operations**: AI generation, video searches
- **Rate Limiting**: Prevents abuse of expensive operations

---

This UML documentation provides a comprehensive view of the SkillSpark backend architecture and can serve as a reference for development, maintenance, and future enhancements.
